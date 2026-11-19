import crypto from "crypto";
import { EntityManager, LessThan } from "typeorm";
import { AppDataSource } from "../config/data-source";
import { Order, OrderItem } from "../entities";
import { changeStock } from "./inventory";
import { WompiTransaction } from "./wompi";
import { markDiscountUsed } from "./discounts";
import { paymentEmail, sendEmail } from "./email";

// Minutos que se aparta el inventario mientras la clienta paga.
// Si no paga en ese tiempo, el pedido pasa a EXPIRED y las prendas vuelven a la tienda.
export const RESERVATION_MINUTES = 60;

export class OutOfStockError extends Error {
  constructor(public productName: string, public size: string) {
    super(`No hay unidades suficientes de ${productName} en talla ${size}`);
  }
}

export function newReference() {
  const time = Date.now().toString(36).toUpperCase();
  const random = crypto.randomBytes(3).toString("hex").toUpperCase();
  return `NF-${time}-${random}`;
}

type StockLine = Pick<OrderItem, "productId" | "size" | "quantity" | "productName">;

/** Descuenta inventario para un pedido web; falla si alguna talla no tiene unidades suficientes */
export async function reserveStock(manager: EntityManager, items: StockLine[], reference: string) {
  for (const item of items) {
    const stock = await changeStock(manager, {
      productId: item.productId,
      productName: item.productName,
      size: item.size,
      delta: -item.quantity,
      mode: "strict",
      type: "VENTA_WEB",
      reference,
    });
    if (stock === null) throw new OutOfStockError(item.productName, item.size);
  }
}

/** Devuelve el inventario apartado (pago rechazado, anulado o expirado) */
export async function releaseStock(manager: EntityManager, items: StockLine[], reference: string, note: string) {
  for (const item of items) {
    await changeStock(manager, {
      productId: item.productId,
      productName: item.productName,
      size: item.size,
      delta: item.quantity,
      type: "LIBERACION",
      reference,
      note,
    });
  }
}

/**
 * Pago aprobado de un pedido cuyo inventario ya se había liberado (p. ej. un PSE que se
 * aprobó después de expirar). El dinero ya entró, así que se descuenta sin bloquear:
 * si no alcanza, queda en 0 y queda anotado en el historial.
 */
async function forceTakeStock(manager: EntityManager, items: StockLine[], reference: string) {
  for (const item of items) {
    await changeStock(manager, {
      productId: item.productId,
      productName: item.productName,
      size: item.size,
      delta: -item.quantity,
      mode: "floor",
      type: "VENTA_WEB",
      reference,
      note: "Pago aprobado después de liberar la reserva: revisar existencias",
    });
  }
}

async function lockOrder(manager: EntityManager, where: Partial<Order>) {
  const order = await manager.findOne(Order, {
    where: where as any,
    lock: { mode: "pessimistic_write" },
    loadEagerRelations: false,
  });
  if (order) order.items = await manager.find(OrderItem, { where: { orderId: order.id } });
  return order;
}

/**
 * Aplica el resultado de una transacción de Wompi al pedido.
 * Se usa tanto desde el webhook como al consultar la transacción tras la redirección,
 * por eso es idempotente: aplicar el mismo evento dos veces no descuadra el inventario.
 */
export async function applyTransaction(tx: WompiTransaction): Promise<Order | null> {
  let approvedNow = false;
  const result = await AppDataSource.transaction(async (manager) => {
    const order = await lockOrder(manager, { reference: tx.reference });
    if (!order) return null;

    // El monto y la moneda deben coincidir con lo que se cobró
    if (Number(tx.amount_in_cents) !== order.total * 100 || tx.currency !== "COP") {
      console.error(`Wompi: monto/moneda no coincide para ${order.reference}`, tx);
      return order;
    }

    switch (tx.status) {
      case "APPROVED":
        if (order.status === "APPROVED") break;
        if (!order.stockReserved) await forceTakeStock(manager, order.items, order.reference);
        await markDiscountUsed(manager, order.discountCode); // el código cuenta como usado solo al pagar
        approvedNow = true;
        order.status = "APPROVED";
        order.stockReserved = true;
        order.paidAt = new Date();
        order.wompiTransactionId = tx.id;
        order.paymentMethod = tx.payment_method_type || order.paymentMethod;
        break;

      case "VOIDED":
        // Anulación de un pago que ya estaba aprobado
        if (order.status === "APPROVED" && order.wompiTransactionId !== tx.id) break;
      // falls through
      case "DECLINED":
      case "ERROR":
        // Un rechazo de otro intento no tumba un pedido ya pagado
        if (order.status === "APPROVED" && tx.status !== "VOIDED") break;
        if (order.stockReserved) {
          await releaseStock(manager, order.items, order.reference, { DECLINED: "Pago rechazado en Wompi", VOIDED: "Pago anulado en Wompi", ERROR: "Error en el pago de Wompi" }[tx.status as "DECLINED"]);
        }
        order.stockReserved = false;
        order.status = tx.status as Order["status"];
        order.wompiTransactionId = tx.id;
        order.paymentMethod = tx.payment_method_type || order.paymentMethod;
        break;

      default:
        // PENDING: se espera el resultado final
        if (!order.wompiTransactionId) {
          order.wompiTransactionId = tx.id;
          order.paymentMethod = tx.payment_method_type || order.paymentMethod;
        }
    }

    await manager.update(Order, order.id, {
      status: order.status,
      stockReserved: order.stockReserved,
      paidAt: order.paidAt,
      wompiTransactionId: order.wompiTransactionId,
      paymentMethod: order.paymentMethod,
    });
    return order;
  });

  // Solo la primera vez que pasa a pagado (el webhook y la redirección pueden llegar los dos)
  if (approvedNow && result?.email) {
    const mail = paymentEmail(result);
    sendEmail({ to: result.email, toName: result.customerName, ...mail, category: "pago" }).catch(() => {});
  }
  return result;
}

/** Libera el inventario de los pedidos que llevan demasiado tiempo sin pagarse */
export async function expireStaleOrders() {
  const limit = new Date(Date.now() - RESERVATION_MINUTES * 60_000);
  const stale = await AppDataSource.getRepository(Order).find({
    where: { status: "PENDING", stockReserved: true, createdAt: LessThan(limit) },
    select: ["id"],
    loadEagerRelations: false,
  });

  for (const { id } of stale) {
    await AppDataSource.transaction(async (manager) => {
      const order = await lockOrder(manager, { id });
      if (!order || order.status !== "PENDING" || !order.stockReserved) return;
      await releaseStock(manager, order.items, order.reference, "Pedido sin pagar: reserva vencida");
      await manager.update(Order, order.id, { status: "EXPIRED", stockReserved: false });
    });
  }
}
