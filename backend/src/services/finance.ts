import { AppDataSource } from "../config/data-source";
import { Order, Product, SiteSetting } from "../entities";

// Todas las fechas de los reportes se interpretan en hora de Colombia (UTC-5, sin horario de verano)
export const TZ = "America/Bogota";
const OFFSET = "-05:00";
const IVA = 0.19;

/** Periodo + filtros opcionales de los reportes */
export interface Range {
  from: string; // YYYY-MM-DD (incluido)
  to: string; // YYYY-MM-DD (incluido)
  channel?: "WEB" | "MANUAL";
  payment?: string;
  categoryId?: number;
  productId?: number;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
export const isDate = (v: unknown): v is string => typeof v === "string" && DATE_RE.test(v);

export function todayInColombia() {
  return new Date(Date.now() - 5 * 3600_000).toISOString().slice(0, 10);
}

export function addDays(date: string, days: number) {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

const daysBetween = (a: string, b: string) =>
  Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);

/** Límites [desde, hasta) como timestamps en hora de Colombia */
function bounds(range: Range): [string, string] {
  return [`${range.from}T00:00:00${OFFSET}`, `${addDays(range.to, 1)}T00:00:00${OFFSET}`];
}

/** Periodo anterior de la misma duración (para comparar), con los mismos filtros */
export function previousRange(range: Range): Range {
  const length = daysBetween(range.from, range.to) + 1;
  return { ...range, from: addDays(range.from, -length), to: addDays(range.from, -1) };
}

/** true si hay algún filtro aparte de las fechas */
export const hasFilters = (r: Range) => !!(r.channel || r.payment || r.categoryId || r.productId);

/**
 * Condiciones SQL de los filtros. Los parámetros se numeran desde `start`
 * ($1 y $2 son siempre las fechas).
 */
function filterSql(r: Range, start = 3) {
  const conditions: string[] = [];
  const params: unknown[] = [];
  const add = (sql: string, value: unknown) => {
    params.push(value);
    conditions.push(sql.replace("?", `$${start + params.length - 1}`));
  };
  if (r.channel) add(`o.channel = ?`, r.channel);
  if (r.payment) add(`COALESCE(o."paymentMethod", 'SIN DATO') = ?`, r.payment);
  if (r.categoryId) add(`p."categoryId" = ?`, r.categoryId);
  if (r.productId) add(`i."productId" = ?`, r.productId);
  return { sql: conditions.map((c) => ` AND ${c}`).join(""), params };
}

/** Comisión estimada de Wompi por pedido web (porcentaje + fijo, más IVA) */
export async function feeConfig() {
  const rows = await AppDataSource.getRepository(SiteSetting).find();
  const get = (key: string, fallback: number) => {
    const v = parseFloat(rows.find((r) => r.key === key)?.value ?? "");
    return Number.isFinite(v) && v >= 0 ? v : fallback;
  };
  return { percent: get("wompiFeePercent", 2.65), fixed: get("wompiFeeFixed", 700) };
}

// Pedido que cuenta como venta: pagado y no cancelado
const SOLD = `o.status = 'APPROVED' AND o."fulfillmentStatus" <> 'CANCELADO'`;
// Costo unitario: el guardado al vender; si es una venta vieja sin costo, el costo actual del producto
const UNIT_COST = `COALESCE(i."unitCost", ROUND(p.cost))`;
// Venta neta de una línea: precio × cantidad menos su parte del descuento del pedido
// (el descuento es un % sobre las prendas, así que se reparte en proporción a cada línea)
const LINE_REVENUE = `(i."unitPrice" * i.quantity * COALESCE(1 - o."discountAmount"::numeric / NULLIF(o.subtotal, 0), 1))`;
// Líneas vendidas en el periodo
const LINES_FROM = `FROM order_items i
       JOIN orders o ON o.id = i."orderId"
       LEFT JOIN product p ON p.id = i."productId"
      WHERE ${SOLD} AND o."paidAt" >= $1 AND o."paidAt" < $2`;

/**
 * Envío y comisión se cobran por pedido. Cuando se filtra por prenda o categoría,
 * a cada pedido se le asigna la parte proporcional a lo que se vendió de esa prenda.
 * Parámetros: $1-$2 fechas, $3-$4 tarifa, $5… filtros.
 */
function ordersCte(range: Range, fee: { percent: number; fixed: number }, extraSelect = "", extraGroup = "") {
  const f = filterSql(range, 5);
  return {
    sql: `WITH m AS (
        SELECT o.id, o.channel, o.total, o."shippingCost" AS shipping, o.subtotal,
               SUM(i."unitPrice" * i.quantity) AS matched ${extraSelect}
          ${LINES_FROM}${f.sql}
         GROUP BY o.id ${extraGroup}
      ), w AS (
        SELECT *, CASE WHEN subtotal > 0 THEN matched::numeric / subtotal ELSE 1 END AS share,
               CASE WHEN channel = 'WEB' THEN (total * $3::numeric / 100.0 + $4::numeric) * (1 + ${IVA}) ELSE 0 END AS fee
          FROM m
      )`,
    params: [fee.percent, fee.fixed, ...f.params],
  };
}

export interface Kpis {
  revenue: number; // ventas de prendas
  shipping: number; // envíos cobrados
  grossSales: number; // revenue + shipping
  cogs: number; // costo de las prendas vendidas
  grossProfit: number; // revenue - cogs
  paymentFees: number; // comisiones de pasarela estimadas
  expenses: number; // gastos registrados (solo sin filtros)
  netProfit: number; // grossSales - cogs - fees - expenses
  margin: number; // netProfit / grossSales
  grossMargin: number; // grossProfit / revenue
  orders: number;
  units: number;
  avgTicket: number;
  unitsWithoutCost: number;
}

const n = (v: unknown) => Math.round(Number(v) || 0);

export async function computeKpis(range: Range): Promise<Kpis> {
  const [from, to] = bounds(range);
  const fee = await feeConfig();
  const f = filterSql(range);

  const [lines] = await AppDataSource.query(
    `SELECT COALESCE(SUM(${LINE_REVENUE}), 0) AS revenue,
            COALESCE(SUM(${UNIT_COST} * i.quantity), 0) AS cogs,
            COALESCE(SUM(i.quantity), 0) AS units,
            COALESCE(SUM(CASE WHEN ${UNIT_COST} IS NULL THEN i.quantity ELSE 0 END), 0) AS "unitsWithoutCost"
       ${LINES_FROM}${f.sql}`,
    [from, to, ...f.params]
  );

  const cte = ordersCte(range, fee);
  const [orders] = await AppDataSource.query(
    `${cte.sql}
     SELECT COUNT(*) AS orders, COALESCE(SUM(shipping * share), 0) AS shipping, COALESCE(SUM(fee * share), 0) AS fees FROM w`,
    [from, to, ...cte.params]
  );

  // Los gastos son del negocio completo: solo se restan cuando no hay filtros
  const [exp] = hasFilters(range)
    ? [{ total: 0 }]
    : await AppDataSource.query(
        `SELECT COALESCE(SUM(amount), 0) AS total FROM expenses WHERE date >= $1 AND date <= $2`,
        [range.from, range.to]
      );

  const revenue = n(lines.revenue);
  const shipping = n(orders.shipping);
  const cogs = n(lines.cogs);
  const paymentFees = n(orders.fees);
  const expenses = n(exp.total);
  const grossSales = revenue + shipping;
  const netProfit = grossSales - cogs - paymentFees - expenses;
  const count = n(orders.orders);
  return {
    revenue,
    shipping,
    grossSales,
    cogs,
    grossProfit: revenue - cogs,
    paymentFees,
    expenses,
    netProfit,
    margin: grossSales ? netProfit / grossSales : 0,
    grossMargin: revenue ? (revenue - cogs) / revenue : 0,
    orders: count,
    units: n(lines.units),
    avgTicket: count ? Math.round(grossSales / count) : 0,
    unitsWithoutCost: n(lines.unitsWithoutCost),
  };
}

export interface SeriesPoint {
  period: string;
  revenue: number;
  netProfit: number;
  orders: number;
  units: number;
}

/** Ventas y utilidad por día (rangos cortos) o por mes (rangos largos) */
export async function computeSeries(range: Range): Promise<{ groupBy: "day" | "month"; points: SeriesPoint[] }> {
  const [from, to] = bounds(range);
  const groupBy = daysBetween(range.from, range.to) <= 62 ? "day" : "month";
  const fmt = groupBy === "day" ? "YYYY-MM-DD" : "YYYY-MM";
  const fee = await feeConfig();
  const period = `to_char(o."paidAt" AT TIME ZONE '${TZ}', '${fmt}')`;
  const f = filterSql(range);

  const lines: any[] = await AppDataSource.query(
    `SELECT ${period} AS period,
            SUM(${LINE_REVENUE}) AS revenue,
            SUM(COALESCE(${UNIT_COST}, 0) * i.quantity) AS cogs,
            SUM(i.quantity) AS units
       ${LINES_FROM}${f.sql}
      GROUP BY 1`,
    [from, to, ...f.params]
  );
  const cte = ordersCte(range, fee, `, ${period} AS period`, `, ${period}`);
  const orders: any[] = await AppDataSource.query(
    `${cte.sql}
     SELECT period, COUNT(*) AS orders, SUM(shipping * share) AS shipping, SUM(fee * share) AS fees FROM w GROUP BY 1`,
    [from, to, ...cte.params]
  );
  const expenses: any[] = hasFilters(range)
    ? []
    : await AppDataSource.query(
        `SELECT to_char(date, '${fmt}') AS period, SUM(amount) AS total
           FROM expenses WHERE date >= $1 AND date <= $2 GROUP BY 1`,
        [range.from, range.to]
      );

  // Todos los periodos del rango, aunque no tengan ventas
  const periods: string[] = [];
  if (groupBy === "day") {
    for (let d = range.from; d <= range.to; d = addDays(d, 1)) periods.push(d);
  } else {
    let [y, m] = range.from.slice(0, 7).split("-").map(Number);
    const end = range.to.slice(0, 7);
    while (true) {
      const p = `${y}-${String(m).padStart(2, "0")}`;
      if (p > end) break;
      periods.push(p);
      m++;
      if (m > 12) { m = 1; y++; }
    }
  }

  const find = (rows: any[], p: string) => rows.find((r) => r.period === p) || {};
  return {
    groupBy,
    points: periods.map((p) => {
      const l = find(lines, p);
      const o = find(orders, p);
      const e = find(expenses, p);
      const revenue = n(l.revenue);
      return {
        period: p,
        revenue,
        netProfit: revenue + n(o.shipping) - n(l.cogs) - n(o.fees) - n(e.total),
        orders: n(o.orders),
        units: n(l.units),
      };
    }),
  };
}

/** Rankings y desgloses del periodo */
export async function computeBreakdowns(range: Range) {
  const [from, to] = bounds(range);
  const f = filterSql(range);
  const base = `FROM order_items i
       JOIN orders o ON o.id = i."orderId"
       LEFT JOIN product p ON p.id = i."productId"
       LEFT JOIN category c ON c.id = p."categoryId"
      WHERE ${SOLD} AND o."paidAt" >= $1 AND o."paidAt" < $2${f.sql}`;
  const metrics = `SUM(i.quantity) AS units,
            SUM(${LINE_REVENUE}) AS revenue,
            SUM(${LINE_REVENUE}) - SUM(COALESCE(${UNIT_COST}, 0) * i.quantity) AS profit,
            BOOL_OR(${UNIT_COST} IS NULL) AS "missingCost"`;
  const rows = async (sql: string) =>
    ((await AppDataSource.query(sql, [from, to, ...f.params])) as any[]).map((r) => ({
      ...r,
      units: n(r.units),
      revenue: n(r.revenue),
      profit: n(r.profit),
      ...(r.orders !== undefined ? { orders: n(r.orders) } : {}),
    }));

  const [topProducts, bySize, byCategory, byChannel, byPayment, byDepartment, expensesByCategory] = await Promise.all([
    rows(`SELECT i."productId" AS "productId", MAX(i."productName") AS name, ${metrics} ${base}
          GROUP BY i."productId" ORDER BY units DESC, revenue DESC LIMIT 10`),
    rows(`SELECT i.size AS name, ${metrics} ${base} GROUP BY i.size ORDER BY units DESC`),
    rows(`SELECT COALESCE(c.name, 'Sin categoría') AS name, ${metrics} ${base} GROUP BY 1 ORDER BY revenue DESC`),
    rows(`SELECT o.channel AS name, COUNT(DISTINCT o.id) AS orders, ${metrics} ${base} GROUP BY 1 ORDER BY revenue DESC`),
    rows(`SELECT COALESCE(o."paymentMethod", 'SIN DATO') AS name, COUNT(DISTINCT o.id) AS orders, ${metrics} ${base}
          GROUP BY 1 ORDER BY revenue DESC`),
    rows(`SELECT COALESCE(NULLIF(o.department, ''), 'Sin dato') AS name, COUNT(DISTINCT o.id) AS orders, ${metrics} ${base}
          GROUP BY 1 ORDER BY revenue DESC LIMIT 10`),
    hasFilters(range)
      ? Promise.resolve([] as { name: string; total: number }[])
      : AppDataSource.query(
          `SELECT category AS name, SUM(amount) AS total FROM expenses
            WHERE date >= $1 AND date <= $2 GROUP BY 1 ORDER BY 2 DESC`,
          [range.from, range.to]
        ).then((r: any[]) => r.map((x) => ({ name: x.name, total: n(x.total) }))),
  ]);

  // Solo prendas con costo registrado: sin costo la "utilidad" sería el precio completo
  const mostProfitable = topProducts.filter((p) => !p.missingCost).sort((a, b) => b.profit - a.profit).slice(0, 5);
  return { topProducts, mostProfitable, bySize, byCategory, byChannel, byPayment, byDepartment, expensesByCategory };
}

/** Prendas activas sin vender en el periodo que todavía tienen stock (capital quieto) */
export async function slowMovers(range: Range) {
  const [from, to] = bounds(range);
  const params: unknown[] = [from, to];
  let productFilter = "";
  let orderFilter = "";
  if (range.categoryId) { params.push(range.categoryId); productFilter += ` AND p."categoryId" = $${params.length}`; }
  if (range.productId) { params.push(range.productId); productFilter += ` AND p.id = $${params.length}`; }
  if (range.channel) { params.push(range.channel); orderFilter += ` AND o.channel = $${params.length}`; }
  if (range.payment) { params.push(range.payment); orderFilter += ` AND COALESCE(o."paymentMethod", 'SIN DATO') = $${params.length}`; }

  const rows: any[] = await AppDataSource.query(
    `SELECT p.id, p.name, ROUND(p.price) AS price, ROUND(p.cost) AS cost,
            COALESCE((SELECT SUM(s.stock) FROM product_size s WHERE s."productId" = p.id), 0) AS stock
       FROM product p
      WHERE p."isActive" = true${productFilter}
        AND NOT EXISTS (
          SELECT 1 FROM order_items i JOIN orders o ON o.id = i."orderId"
           WHERE i."productId" = p.id AND ${SOLD} AND o."paidAt" >= $1 AND o."paidAt" < $2${orderFilter})
      ORDER BY stock DESC LIMIT 10`,
    params
  );
  return rows
    .map((r) => ({ id: r.id, name: r.name, price: n(r.price), cost: r.cost === null ? null : n(r.cost), stock: n(r.stock) }))
    .filter((r) => r.stock > 0);
}

// ---------- Cierres ----------

export function monthRange(year: number, month: number): Range {
  const from = `${year}-${String(month).padStart(2, "0")}-01`;
  const next = month === 12 ? `${year + 1}-01-01` : `${year}-${String(month + 1).padStart(2, "0")}-01`;
  return { from, to: addDays(next, -1) };
}

export type Filters = Omit<Range, "from" | "to">;

export async function monthlyClose(year: number, filters: Filters = {}) {
  const months = await Promise.all(
    Array.from({ length: 12 }, (_, i) =>
      computeKpis({ ...filters, ...monthRange(year, i + 1) }).then((k) => ({ month: i + 1, ...k }))
    )
  );
  const total = await computeKpis({ ...filters, from: `${year}-01-01`, to: `${year}-12-31` });
  return { year, months, total };
}

export async function yearlyClose(filters: Filters = {}) {
  const [row] = await AppDataSource.query(
    `SELECT MIN(EXTRACT(YEAR FROM "paidAt" AT TIME ZONE '${TZ}')) AS first FROM orders WHERE status = 'APPROVED'`
  );
  const current = parseInt(todayInColombia().slice(0, 4), 10);
  const first = Math.min(parseInt(row?.first, 10) || current, current);
  const years = [];
  for (let y = current; y >= first; y--) {
    years.push({ year: y, ...(await computeKpis({ ...filters, from: `${y}-01-01`, to: `${y}-12-31` })) });
  }
  return years;
}

// ---------- Ventas detalladas ----------

export async function listSales(range: Range) {
  const qb = AppDataSource.getRepository(Order)
    .createQueryBuilder("o")
    .leftJoinAndSelect("o.items", "items")
    .where("o.paidAt >= :from AND o.paidAt < :to", {
      from: `${range.from}T00:00:00-05:00`,
      to: `${addDays(range.to, 1)}T00:00:00-05:00`,
    })
    .andWhere("(o.status = 'APPROVED' OR (o.channel = 'MANUAL' AND o.status = 'VOIDED'))")
    .orderBy("o.paidAt", "DESC");
  if (range.channel) qb.andWhere("o.channel = :channel", { channel: range.channel });
  if (range.payment) qb.andWhere(`COALESCE(o."paymentMethod", 'SIN DATO') = :payment`, { payment: range.payment });
  const orders = await qb.getMany();

  // Costo y categoría actuales de los productos (costo: para ventas antiguas que no lo guardaron)
  const ids = [...new Set(orders.flatMap((o) => o.items.map((i) => i.productId)))];
  const info = new Map<number, { cost: number | null; categoryId: number }>();
  if (ids.length) {
    const rows = await AppDataSource.getRepository(Product)
      .createQueryBuilder("p")
      .select(["p.id", "p.categoryId"])
      .addSelect("p.cost")
      .where("p.id IN (:...ids)", { ids })
      .getMany();
    rows.forEach((p) =>
      info.set(p.id, { cost: p.cost === null ? null : Math.round(Number(p.cost)), categoryId: p.categoryId })
    );
  }

  const matches = (productId: number) =>
    (!range.productId || productId === range.productId) &&
    (!range.categoryId || info.get(productId)?.categoryId === range.categoryId);

  return orders
    .map((o) => {
      // Parte que se cobró de cada peso de prenda tras el descuento del pedido
      const netRate = o.subtotal > 0 ? 1 - (o.discountAmount || 0) / o.subtotal : 1;
      const items = o.items
        .filter((i) => matches(i.productId))
        .map((i) => {
          const unitCost = i.unitCost ?? info.get(i.productId)?.cost ?? null;
          const net = Math.round(i.unitPrice * i.quantity * netRate);
          return { ...i, unitCost, profit: unitCost === null ? null : net - unitCost * i.quantity };
        });
      const missingCost = items.some((i) => i.unitCost === null);
      const cogs = items.reduce((s, i) => s + (i.unitCost ?? 0) * i.quantity, 0);
      const subtotal = Math.round(items.reduce((s, i) => s + i.unitPrice * i.quantity, 0) * netRate);
      return { ...o, items, cogs, grossProfit: subtotal - cogs, missingCost };
    })
    .filter((o) => o.items.length > 0);
}
