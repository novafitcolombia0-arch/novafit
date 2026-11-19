import { Request, Response } from "express";
import { createRouter } from "../middleware/errors";
import { AppDataSource } from "../config/data-source";
import { Order, OrderItem, Product, SiteSetting } from "../entities";
import { authMiddleware } from "../middleware/auth";
import { fetchTransaction, integritySignature, isValidEvent, wompiConfig } from "../services/wompi";
import {
  applyTransaction,
  expireStaleOrders,
  newReference,
  OutOfStockError,
  reserveStock,
} from "../services/orders";
import { evaluateDiscount } from "../services/discounts";
import { checkoutLimiter } from "../config/security";
import { emailConfig, enqueueEmail, shippedEmail } from "../services/email";

// Pedidos sin pagar que una misma persona puede tener apartando inventario a la vez
const MAX_PENDING_PER_EMAIL = 3;

const router = createRouter();
const orderRepo = () => AppDataSource.getRepository(Order);

const MAX_QTY_PER_LINE = 10;

/**
 * Modo simulación (solo para probar en local): con WOMPI_SIMULATION=true el botón
 * "Pagar" no va a Wompi sino a una pantalla de prueba de la tienda donde se elige
 * si el pago sale aprobado o rechazado. Nunca activarlo en producción.
 */
//   WOMPI_SIMULATION=auto → el botón aprueba el pago al instante, como si Wompi lo hubiera aprobado
const simulationEnabled = () => ["true", "auto"].includes(process.env.WOMPI_SIMULATION || "");
const simulationAuto = () => process.env.WOMPI_SIMULATION === "auto";

async function getNumberSetting(key: string) {
  const setting = await AppDataSource.getRepository(SiteSetting).findOne({ where: { key } });
  const value = parseInt(setting?.value || "0", 10);
  return Number.isFinite(value) && value > 0 ? value : 0;
}

/** Costo de envío configurado en el panel (y envío gratis desde cierto monto, si se definió) */
export async function shippingFor(subtotal: number) {
  const [cost, freeFrom] = await Promise.all([
    getNumberSetting("shippingCost"),
    getNumberSetting("freeShippingFrom"),
  ]);
  if (freeFrom && subtotal >= freeFrom) return 0;
  return cost;
}

// Lo que ve la clienta en la página de resultado (sin dirección ni correo)
const publicView = (order: Order) => ({
  reference: order.reference,
  status: order.status,
  customerName: order.customerName.split(" ")[0],
  subtotal: order.subtotal,
  discountCode: order.discountCode,
  discountAmount: order.discountAmount,
  shippingCost: order.shippingCost,
  total: order.total,
  paymentMethod: order.paymentMethod,
  createdAt: order.createdAt,
  items: order.items.map(({ productName, size, unitPrice, quantity }) => ({
    productName,
    size,
    unitPrice,
    quantity,
  })),
});

const clean = (value: unknown, max = 200) => String(value ?? "").trim().slice(0, max);

/**
 * Crea el pedido, aparta el inventario y devuelve la URL del Web Checkout de Wompi.
 * Los precios se toman de la base de datos, nunca del navegador.
 */
router.post("/checkout", checkoutLimiter, async (req: Request, res: Response) => {
  const wompi = wompiConfig();
  if (!wompi.configured && !simulationEnabled()) {
    if (wompi.problems.length) console.error("Wompi mal configurado:", wompi.problems.join(" | "));
    return res.status(503).json({ message: "Los pagos en línea no están configurados todavía" });
  }

  const { items, customer } = req.body || {};
  if (!Array.isArray(items) || items.length === 0 || items.length > 30) {
    return res.status(400).json({ message: "El carrito está vacío" });
  }

  const c = {
    customerName: clean(customer?.name, 120),
    email: clean(customer?.email, 120).toLowerCase(),
    phone: clean(customer?.phone, 20).replace(/\D/g, ""),
    documentId: clean(customer?.documentId, 20).replace(/\D/g, ""),
    department: clean(customer?.department, 60),
    city: clean(customer?.city, 60),
    address: clean(customer?.address, 200),
    notes: clean(customer?.notes, 500),
  };
  if (!c.customerName || !c.department || !c.city || !c.address) {
    return res.status(400).json({ message: "Completa tus datos de envío" });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c.email)) {
    return res.status(400).json({ message: "Correo electrónico no válido" });
  }
  if (c.phone.length < 10) {
    return res.status(400).json({ message: "Número de celular no válido" });
  }

  // Unir líneas repetidas (mismo producto y talla)
  const lines = new Map<string, { productId: number; size: string; quantity: number }>();
  for (const raw of items) {
    const productId = parseInt(raw?.productId, 10);
    const size = clean(raw?.size, 20);
    const quantity = parseInt(raw?.quantity, 10);
    if (!productId || !size || !quantity || quantity < 1) {
      return res.status(400).json({ message: "Hay un producto inválido en el carrito" });
    }
    const key = `${productId}|${size}`;
    const line = lines.get(key) || { productId, size, quantity: 0 };
    line.quantity += quantity;
    if (line.quantity > MAX_QTY_PER_LINE) {
      return res.status(400).json({ message: `Máximo ${MAX_QTY_PER_LINE} unidades por talla` });
    }
    lines.set(key, line);
  }

  const productIds = [...new Set([...lines.values()].map((l) => l.productId))];
  const products = await AppDataSource.getRepository(Product)
    .createQueryBuilder("p")
    .addSelect("p.cost")
    .leftJoinAndSelect("p.sizes", "sizes")
    .where("p.id IN (:...ids) AND p.isActive = true", { ids: productIds })
    .getMany();

  const orderItems: Partial<OrderItem>[] = [];
  for (const line of lines.values()) {
    const product = products.find((p) => p.id === line.productId);
    if (!product) {
      return res.status(409).json({ message: "Uno de los productos ya no está disponible" });
    }
    if (!product.sizes.some((s) => s.size === line.size)) {
      return res.status(409).json({ message: `La talla ${line.size} de ${product.name} ya no está disponible` });
    }
    orderItems.push({
      productId: product.id,
      productName: product.name,
      size: line.size,
      unitPrice: Math.round(Number(product.price)),
      unitCost: product.cost === null || product.cost === undefined ? null : Math.round(Number(product.cost)),
      quantity: line.quantity,
    });
  }

  const subtotal = orderItems.reduce((sum, i) => sum + i.unitPrice! * i.quantity!, 0);

  // Descuento: se recalcula aquí, nunca se confía en el navegador
  let discountCode: string | undefined;
  let discountAmount = 0;
  if (req.body?.discountCode) {
    const discount = await evaluateDiscount(req.body.discountCode, c.email, subtotal);
    if (!discount.ok) return res.status(400).json({ message: discount.message });
    discountCode = discount.discount.code;
    discountAmount = discount.amount;
  }

  const shippingCost = await shippingFor(subtotal - discountAmount);
  const total = subtotal - discountAmount + shippingCost;

  await expireStaleOrders().catch((e) => console.error("expireStaleOrders", e?.message));

  // Evita que alguien deje la tienda "agotada" creando pedidos sin pagar en bucle
  const pending = await orderRepo()
    .createQueryBuilder("o")
    .where("LOWER(o.email) = :email AND o.status = 'PENDING' AND o.\"stockReserved\" = true", { email: c.email })
    .getCount();
  if (pending >= MAX_PENDING_PER_EMAIL) {
    return res.status(429).json({ message: "Tienes pagos pendientes sin terminar. Complétalos o espera unos minutos antes de iniciar otro." });
  }

  let order: Order;
  try {
    const reference = newReference();
    order = await AppDataSource.transaction(async (manager) => {
      await reserveStock(manager, orderItems as OrderItem[], reference);
      const created = manager.create(Order, {
        ...c,
        documentId: c.documentId || undefined,
        notes: c.notes || undefined,
        reference,
        status: "PENDING",
        subtotal,
        discountCode,
        discountAmount,
        shippingCost,
        total,
        stockReserved: true,
        items: orderItems as OrderItem[],
      });
      return manager.save(created);
    });
  } catch (err) {
    if (err instanceof OutOfStockError) return res.status(409).json({ message: err.message });
    throw err;
  }

  const amountInCents = total * 100;
  const frontendUrl = (process.env.FRONTEND_URL || req.get("origin") || "http://localhost:4200").replace(/\/$/, "");
  const params = new URLSearchParams({
    "public-key": wompi.publicKey,
    currency: "COP",
    "amount-in-cents": String(amountInCents),
    reference: order.reference,
    "signature:integrity": integritySignature(order.reference, amountInCents),
    "redirect-url": `${frontendUrl}/pedido/${order.reference}`,
    "customer-data:email": c.email,
    "customer-data:full-name": c.customerName,
    "customer-data:phone-number": c.phone,
    "customer-data:phone-number-prefix": "+57",
    "shipping-address:address-line-1": c.address,
    "shipping-address:country": "CO",
    "shipping-address:region": c.department,
    "shipping-address:city": c.city,
    "shipping-address:phone-number": c.phone,
  });
  if (c.documentId) {
    params.set("customer-data:legal-id", c.documentId);
    params.set("customer-data:legal-id-type", "CC");
  }
  // El cortafuegos de Wompi responde 403 si redirect-url es local (localhost, 127.0.0.1, IP privada).
  // En local se omite: Wompi muestra su propio comprobante y el pedido se consulta en /pedido/<referencia>.
  if (!/^https:\/\//.test(frontendUrl) || /\/\/(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(frontendUrl)) {
    params.delete("redirect-url");
  }

  if (simulationAuto()) {
    // Pago aprobado de inmediato, procesado igual que una respuesta real de Wompi
    const transactionId = `SIM-${Date.now()}`;
    await applyTransaction({
      id: transactionId,
      status: "APPROVED",
      reference: order.reference,
      amount_in_cents: amountInCents,
      currency: "COP",
      payment_method_type: "CARD",
    });
    return res.status(201).json({
      reference: order.reference,
      checkoutUrl: `${frontendUrl}/pedido/${order.reference}?id=${transactionId}`,
    });
  }
  if (simulationEnabled()) {
    return res.status(201).json({ reference: order.reference, checkoutUrl: `${frontendUrl}/pago-simulado/${order.reference}` });
  }
  res.status(201).json({ reference: order.reference, checkoutUrl: `${wompi.checkoutUrl}?${params.toString()}` });
});

/**
 * Estado del pedido para la página de resultado. Wompi redirige con ?id=<transacción>:
 * si el pedido sigue pendiente se consulta la transacción en Wompi para no depender
 * solo del webhook.
 */
router.get("/by-reference/:reference", async (req: Request, res: Response) => {
  const reference = clean(req.params.reference, 40);
  let order = await orderRepo().findOne({ where: { reference } });
  if (!order) return res.status(404).json({ message: "Pedido no encontrado" });

  const transactionId = clean(req.query.id, 80);
  if (transactionId && !transactionId.startsWith("SIM-") && order.status !== "APPROVED") {
    const tx = await fetchTransaction(transactionId);
    if (tx && tx.reference === order.reference) {
      order = (await applyTransaction(tx)) || order;
      order = (await orderRepo().findOne({ where: { reference } })) || order;
    }
  }
  res.json(publicView(order));
});

/** Resultado de un pago simulado (solo con WOMPI_SIMULATION=true) */
router.post("/simulate/:reference", async (req: Request, res: Response) => {
  if (!simulationEnabled()) return res.status(404).json({ message: "No disponible" });
  const order = await orderRepo().findOne({ where: { reference: clean(req.params.reference, 40) } });
  if (!order) return res.status(404).json({ message: "Pedido no encontrado" });
  if (order.status !== "PENDING") return res.status(409).json({ message: "Este pedido ya no está pendiente de pago" });

  const status = req.body?.status === "DECLINED" ? "DECLINED" : "APPROVED";
  const methods = ["CARD", "PSE", "NEQUI", "BANCOLOMBIA_TRANSFER"];
  const method = methods.includes(req.body?.method) ? req.body.method : "CARD";
  const transactionId = `SIM-${Date.now()}`;
  // Se procesa exactamente igual que una respuesta real de Wompi (inventario, estado, etc.)
  await applyTransaction({
    id: transactionId,
    status,
    reference: order.reference,
    amount_in_cents: order.total * 100,
    currency: "COP",
    payment_method_type: method,
  });
  res.json({ transactionId, status });
});

/** Webhook de eventos de Wompi (URL de eventos configurada en el panel de Wompi) */
router.post("/wompi/webhook", async (req: Request, res: Response) => {
  if (!isValidEvent(req.body)) {
    console.warn("Wompi webhook: firma inválida");
    return res.status(401).json({ message: "Firma inválida" });
  }
  if (req.body.event === "transaction.updated" && req.body.data?.transaction) {
    await applyTransaction(req.body.data.transaction);
  }
  res.json({ received: true });
});

// ---------- Panel de administración ----------

router.get("/", authMiddleware, async (req: Request, res: Response) => {
  await expireStaleOrders().catch((e) => console.error("expireStaleOrders", e?.message));
  const status = clean(req.query.status, 20);
  const orders = await orderRepo().find({
    where: status ? { channel: "WEB", status: status as Order["status"] } : { channel: "WEB" },
    order: { createdAt: "DESC" },
    take: 300,
  });
  res.json(orders);
});

router.patch("/:id", authMiddleware, async (req: Request, res: Response) => {
  const order = await orderRepo().findOne({ where: { id: parseInt(req.params.id as string, 10) } });
  if (!order) return res.status(404).json({ message: "Pedido no encontrado" });

  const previousTracking = order.trackingNumber || "";
  const { fulfillmentStatus, trackingNumber } = req.body || {};
  const allowed = ["POR_DESPACHAR", "DESPACHADO", "ENTREGADO", "CANCELADO"];
  if (fulfillmentStatus !== undefined) {
    if (!allowed.includes(fulfillmentStatus)) return res.status(400).json({ message: "Estado no válido" });
    order.fulfillmentStatus = fulfillmentStatus;
  }
  if (trackingNumber !== undefined) order.trackingNumber = clean(trackingNumber, 80);

  await orderRepo().update(order.id, {
    fulfillmentStatus: order.fulfillmentStatus,
    trackingNumber: order.trackingNumber,
  });

  // Se avisa a la clienta cuando se pone (o cambia) el número de guía de un pedido pagado
  const newTracking = order.trackingNumber || "";
  // Sale por la cola (con reintentos): el panel no espera al proveedor de correo
  let emailSent = false;
  if (newTracking && newTracking !== previousTracking && order.status === "APPROVED" && order.email && emailConfig().configured) {
    void enqueueEmail({ to: order.email, toName: order.customerName, ...shippedEmail(order), category: "envio" });
    emailSent = true;
  }
  res.json({ ...order, emailSent });
});

export default router;
