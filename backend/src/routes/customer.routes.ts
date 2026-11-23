import { Request, Response } from "express";
import { createRouter } from "../middleware/errors";
import { AppDataSource } from "../config/data-source";
import { Order } from "../entities";
import { authMiddleware } from "../middleware/auth";

// Clientes y recompra: se arma a partir de las compras pagadas (web y ventas manuales)
const router = createRouter();
router.use(authMiddleware);

const DAY = 24 * 60 * 60 * 1000;

/**
 * Identifica a la misma clienta entre pedidos: por celular (últimos 10 dígitos), si no hay
 * por correo y, como último recurso, por nombre (ventas manuales sin datos de contacto).
 */
function customerKey(o: Order): string {
  const phone = (o.phone || "").replace(/\D/g, "").slice(-10);
  if (phone.length >= 7) return `tel:${phone}`;
  if (o.email) return `mail:${o.email.trim().toLowerCase()}`;
  return `nombre:${(o.customerName || "").trim().toLowerCase()}`;
}

router.get("/", async (_req: Request, res: Response) => {
  // Compras que cuentan: pagadas y no canceladas (igual que en Finanzas)
  const orders = await AppDataSource.getRepository(Order)
    .createQueryBuilder("o")
    .leftJoinAndSelect("o.items", "items")
    .where(`o.status = 'APPROVED' AND o."fulfillmentStatus" <> 'CANCELADO'`)
    .orderBy("o.paidAt", "ASC")
    .getMany();

  type Customer = {
    key: string; name: string; email: string | null; phone: string | null; city: string | null;
    orders: number; units: number; total: number; firstAt: Date; lastAt: Date;
    daysSinceLast: number; avgDaysBetween: number | null;
    channels: string[];
    history: { reference: string; date: Date; channel: string; total: number; items: string }[];
  };
  const customers = new Map<string, Customer>();
  const now = Date.now();

  for (const o of orders) {
    const date = o.paidAt || o.createdAt;
    const key = customerKey(o);
    let c = customers.get(key);
    if (!c) {
      c = { key, name: o.customerName, email: null, phone: null, city: null, orders: 0, units: 0, total: 0,
        firstAt: date, lastAt: date, daysSinceLast: 0, avgDaysBetween: null, channels: [], history: [] };
      customers.set(key, c);
    }
    // Los datos más recientes reemplazan a los anteriores
    c.name = o.customerName || c.name;
    c.email = o.email || c.email;
    c.phone = o.phone || c.phone;
    c.city = o.city || c.city;
    c.orders += 1;
    c.units += o.items.reduce((n, i) => n + i.quantity, 0);
    c.total += o.total;
    c.lastAt = date;
    if (!c.channels.includes(o.channel)) c.channels.push(o.channel);
    c.history.unshift({
      reference: o.reference,
      date,
      channel: o.channel,
      total: o.total,
      items: o.items.map((i) => `${i.quantity} × ${i.productName} (${i.color ? `${i.color}, ` : ""}${i.size})`).join("; "),
    });
  }

  const list = [...customers.values()].map((c) => {
    c.daysSinceLast = Math.floor((now - new Date(c.lastAt).getTime()) / DAY);
    c.avgDaysBetween = c.orders > 1
      ? Math.round((new Date(c.lastAt).getTime() - new Date(c.firstAt).getTime()) / DAY / (c.orders - 1))
      : null;
    return c;
  });
  list.sort((a, b) => b.orders - a.orders || b.total - a.total);

  const repeat = list.filter((c) => c.orders > 1);
  const revenue = list.reduce((s, c) => s + c.total, 0);
  const repeatRevenue = repeat.reduce((s, c) => s + c.total, 0);
  const gaps = repeat.map((c) => c.avgDaysBetween!).filter((d) => d !== null);
  res.json({
    summary: {
      customers: list.length,
      repeatCustomers: repeat.length,
      repeatRate: list.length ? repeat.length / list.length : 0,
      avgOrders: list.length ? orders.length / list.length : 0,
      repeatRevenueShare: revenue ? repeatRevenue / revenue : 0,
      avgDaysBetween: gaps.length ? Math.round(gaps.reduce((s, d) => s + d, 0) / gaps.length) : null,
    },
    customers: list,
  });
});

export default router;
