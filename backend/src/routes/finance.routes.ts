import { Request, Response } from "express";
import { createRouter } from "../middleware/errors";
import { AppDataSource } from "../config/data-source";
import { Expense, EXPENSE_CATEGORIES, Order, OrderItem, Product } from "../entities";
import { adminOnly, staffMiddleware } from "../middleware/auth";
import {
  computeBreakdowns,
  computeKpis,
  computeSeries,
  Filters,
  isDate,
  previousRange,
  Range,
  listSales,
  monthlyClose,
  slowMovers,
  todayInColombia,
  yearlyClose,
} from "../services/finance";
import { changeStock } from "../services/inventory";
import { newReference, OutOfStockError } from "../services/orders";
import { buildWorkbook } from "../services/finance-export";

const router = createRouter();
// Finanzas la pueden consultar admin y finanzas; registrar o cambiar datos es solo de admin
router.use(staffMiddleware);

export const MANUAL_PAYMENT_METHODS = ["EFECTIVO", "TRANSFERENCIA", "NEQUI", "DAVIPLATA", "DATAFONO", "OTRO"];

/** Filtros opcionales: ?channel=WEB|MANUAL&payment=NEQUI&categoryId=3&productId=7 */
function filtersFrom(req: Request): Filters {
  const q = req.query;
  const f: Filters = {};
  if (q.channel === "WEB" || q.channel === "MANUAL") f.channel = q.channel;
  if (typeof q.payment === "string" && /^[A-Z_ ]{2,40}$/.test(q.payment)) f.payment = q.payment;
  const categoryId = parseInt(q.categoryId as string, 10);
  if (categoryId > 0) f.categoryId = categoryId;
  const productId = parseInt(q.productId as string, 10);
  if (productId > 0) f.productId = productId;
  return f;
}

/** Rango de fechas (?from=YYYY-MM-DD&to=YYYY-MM-DD, por defecto el mes actual) + filtros */
function rangeFrom(req: Request): Range {
  const today = todayInColombia();
  const from = isDate(req.query.from) ? req.query.from : `${today.slice(0, 7)}-01`;
  const to = isDate(req.query.to) ? req.query.to : today;
  return { ...filtersFrom(req), ...(from <= to ? { from, to } : { from: to, to: from }) };
}

// ---------- Reportes ----------

router.get("/summary", async (req: Request, res: Response) => {
  const range = rangeFrom(req);
  const [kpis, previous, series, breakdowns, slow] = await Promise.all([
    computeKpis(range),
    computeKpis(previousRange(range)),
    computeSeries(range),
    computeBreakdowns(range),
    slowMovers(range),
  ]);
  res.json({ range, previousRange: previousRange(range), kpis, previous, series, ...breakdowns, slowMovers: slow });
});

router.get("/monthly", async (req: Request, res: Response) => {
  const year = parseInt(req.query.year as string, 10) || parseInt(todayInColombia().slice(0, 4), 10);
  res.json(await monthlyClose(year, filtersFrom(req)));
});

router.get("/yearly", async (req: Request, res: Response) => {
  res.json(await yearlyClose(filtersFrom(req)));
});

// ---------- Ventas (web + registradas a mano) ----------

router.get("/sales", async (req: Request, res: Response) => {
  res.json(await listSales(rangeFrom(req)));
});

/** Registrar una venta hecha por fuera de la web (WhatsApp, en persona, feria...) */
router.post("/sales", adminOnly, async (req: Request, res: Response) => {
  const { date, paymentMethod, customerName, phone, city, notes, items, shippingCost } = req.body || {};
  const saleDate = isDate(date) ? date : todayInColombia();
  if (saleDate > todayInColombia()) return res.status(400).json({ message: "La fecha no puede ser futura" });
  if (!MANUAL_PAYMENT_METHODS.includes(paymentMethod)) {
    return res.status(400).json({ message: "Selecciona el medio de pago" });
  }
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ message: "Agrega al menos una prenda" });
  }

  const ids = [...new Set(items.map((i: any) => parseInt(i?.productId, 10)).filter(Boolean))];
  const products = ids.length
    ? await AppDataSource.getRepository(Product)
        .createQueryBuilder("p")
        .addSelect("p.cost")
        .where("p.id IN (:...ids)", { ids })
        .getMany()
    : [];

  const lines: Partial<OrderItem>[] = [];
  for (const raw of items) {
    const product = products.find((p) => p.id === parseInt(raw?.productId, 10));
    const quantity = parseInt(raw?.quantity, 10);
    const unitPrice = Math.round(Number(raw?.unitPrice));
    const size = String(raw?.size || "").trim();
    const color = String(raw?.color || "").trim();
    if (!product || !size || !(quantity > 0) || !(unitPrice >= 0)) {
      return res.status(400).json({ message: "Revisa las prendas de la venta" });
    }
    lines.push({
      productId: product.id,
      productName: product.name,
      color,
      size,
      quantity,
      unitPrice,
      unitCost: product.cost === null || product.cost === undefined ? null : Math.round(Number(product.cost)),
    });
  }

  const shipping = Math.max(0, Math.round(Number(shippingCost) || 0));
  const subtotal = lines.reduce((s, l) => s + l.unitPrice! * l.quantity!, 0);
  const reference = newReference().replace("NF-", "NF-M-");
  // Ventas de hoy con la hora actual; de días anteriores, al mediodía de ese día
  const paidAt = saleDate === todayInColombia() ? new Date() : new Date(`${saleDate}T12:00:00-05:00`);

  try {
    const order = await AppDataSource.transaction(async (manager) => {
      for (const l of lines) {
        const stock = await changeStock(manager, {
          productId: l.productId!,
          productName: l.productName!,
          color: l.color,
          size: l.size!,
          delta: -l.quantity!,
          mode: "strict",
          type: "VENTA_MANUAL",
          reference,
        });
        if (stock === null) throw new OutOfStockError(l.productName!, l.color ? `${l.color} / ${l.size}` : l.size!);
      }
      return manager.save(
        manager.create(Order, {
          reference,
          channel: "MANUAL",
          status: "APPROVED",
          fulfillmentStatus: "ENTREGADO",
          customerName: String(customerName || "").trim().slice(0, 120) || "Cliente",
          phone: String(phone || "").replace(/\D/g, "").slice(0, 20) || null,
          city: String(city || "").trim().slice(0, 60) || null,
          notes: String(notes || "").trim().slice(0, 500) || null,
          paymentMethod,
          subtotal,
          shippingCost: shipping,
          total: subtotal + shipping,
          stockReserved: true,
          paidAt,
          items: lines as OrderItem[],
        } as Partial<Order>)
      );
    });
    res.status(201).json(order);
  } catch (err) {
    if (err instanceof OutOfStockError) return res.status(409).json({ message: err.message });
    throw err;
  }
});

/** Anular una venta manual (por error o devolución): devuelve las prendas al inventario */
router.post("/sales/:id/void", adminOnly, async (req: Request, res: Response) => {
  const id = parseInt(req.params.id as string, 10);
  const result = await AppDataSource.transaction(async (manager) => {
    const order = await manager.findOne(Order, {
      where: { id },
      lock: { mode: "pessimistic_write" },
      loadEagerRelations: false,
    });
    if (!order) return { status: 404, message: "Venta no encontrada" };
    if (order.channel !== "MANUAL") {
      return { status: 400, message: "Las ventas web se cancelan desde Pedidos (estado de despacho: Cancelado)" };
    }
    if (order.status !== "APPROVED") return { status: 400, message: "La venta ya estaba anulada" };
    const items = await manager.find(OrderItem, { where: { orderId: order.id } });
    for (const i of items) {
      await changeStock(manager, {
        productId: i.productId,
        productName: i.productName,
        color: i.color,
        size: i.size,
        delta: i.quantity,
        type: "ANULACION",
        reference: order.reference,
        note: String(req.body?.reason || "Venta anulada").slice(0, 200),
      });
    }
    await manager.update(Order, order.id, { status: "VOIDED", stockReserved: false });
    return { status: 200, message: "Venta anulada" };
  });
  res.status(result.status).json({ message: result.message });
});

// ---------- Gastos ----------

function parseExpense(body: any) {
  const date = isDate(body?.date) ? body.date : null;
  const category = EXPENSE_CATEGORIES.includes(body?.category) ? body.category : null;
  const description = String(body?.description || "").trim().slice(0, 200);
  const amount = Math.round(Number(body?.amount));
  if (!date || !category || !description || !(amount > 0)) return null;
  return { date, category, description, amount };
}

router.get("/expenses", async (req: Request, res: Response) => {
  const range = rangeFrom(req);
  const rows = await AppDataSource.getRepository(Expense)
    .createQueryBuilder("e")
    .where("e.date >= :from AND e.date <= :to", range)
    .orderBy("e.date", "DESC")
    .addOrderBy("e.id", "DESC")
    .getMany();
  res.json(rows);
});

router.post("/expenses", adminOnly, async (req: Request, res: Response) => {
  const data = parseExpense(req.body);
  if (!data) return res.status(400).json({ message: "Completa fecha, categoría, descripción y valor" });
  const repo = AppDataSource.getRepository(Expense);
  res.status(201).json(await repo.save(repo.create(data)));
});

router.put("/expenses/:id", adminOnly, async (req: Request, res: Response) => {
  const data = parseExpense(req.body);
  if (!data) return res.status(400).json({ message: "Completa fecha, categoría, descripción y valor" });
  const repo = AppDataSource.getRepository(Expense);
  const id = parseInt(req.params.id as string, 10);
  const result = await repo.update(id, data);
  if (!result.affected) return res.status(404).json({ message: "Gasto no encontrado" });
  res.json(await repo.findOne({ where: { id } }));
});

router.delete("/expenses/:id", adminOnly, async (req: Request, res: Response) => {
  const result = await AppDataSource.getRepository(Expense).delete(parseInt(req.params.id as string, 10));
  if (!result.affected) return res.status(404).json({ message: "Gasto no encontrado" });
  res.json({ message: "Gasto eliminado" });
});

// ---------- Costos de las prendas ----------

router.get("/costs", async (_req: Request, res: Response) => {
  const products = await AppDataSource.getRepository(Product)
    .createQueryBuilder("p")
    .addSelect("p.cost")
    .leftJoinAndSelect("p.category", "category")
    .leftJoinAndSelect("p.sizes", "sizes")
    .orderBy("p.name", "ASC")
    .getMany();
  res.json(
    products.map((p) => ({
      id: p.id,
      name: p.name,
      category: p.category?.name || "",
      isActive: p.isActive,
      price: Math.round(Number(p.price)),
      cost: p.cost === null || p.cost === undefined ? null : Math.round(Number(p.cost)),
      stock: p.sizes.reduce((s, x) => s + x.stock, 0),
      sizes: p.sizes.map((s) => ({ color: s.color || "", size: s.size, stock: s.stock })),
    }))
  );
});

router.put("/costs/:id", adminOnly, async (req: Request, res: Response) => {
  const id = parseInt(req.params.id as string, 10);
  const { price, cost } = req.body || {};
  const update: Partial<Product> = {};
  if (cost === null || cost === "") update.cost = null;
  else if (cost !== undefined) {
    const v = Math.round(Number(cost));
    if (!(v >= 0)) return res.status(400).json({ message: "Costo no válido" });
    update.cost = v;
  }
  if (price !== undefined) {
    const v = Math.round(Number(price));
    if (!(v > 0)) return res.status(400).json({ message: "Precio no válido" });
    update.price = v;
  }
  const result = await AppDataSource.getRepository(Product).update(id, update);
  if (!result.affected) return res.status(404).json({ message: "Producto no encontrado" });
  res.json({ id, ...update });
});

/** Opciones para los filtros (categorías, prendas y medios de pago usados) */
router.get("/filters", async (_req: Request, res: Response) => {
  const [categories, products, payments] = await Promise.all([
    AppDataSource.query(`SELECT id, name FROM category ORDER BY name`),
    AppDataSource.query(`SELECT id, name, "categoryId" FROM product ORDER BY name`),
    AppDataSource.query(
      `SELECT DISTINCT COALESCE("paymentMethod", 'SIN DATO') AS name FROM orders WHERE status = 'APPROVED' ORDER BY 1`
    ),
  ]);
  res.json({ categories, products, payments: payments.map((p: any) => p.name) });
});

// ---------- Excel ----------

router.get("/export", async (req: Request, res: Response) => {
  const range = rangeFrom(req);
  const workbook = await buildWorkbook(range);
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", `attachment; filename="nova-finanzas-${range.from}_a_${range.to}.xlsx"`);
  await workbook.xlsx.write(res);
  res.end();
});

export default router;
