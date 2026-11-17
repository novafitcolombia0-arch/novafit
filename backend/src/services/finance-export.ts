import ExcelJS from "exceljs";
import { AppDataSource } from "../config/data-source";
import { Expense, Product } from "../entities";
import { COLOR_PROFIT, COLOR_SALES, groupedBarChart, horizontalBarChart } from "./finance-charts";
import {
  computeBreakdowns,
  hasFilters,
  computeKpis,
  computeSeries,
  Kpis,
  listSales,
  monthlyClose,
  previousRange,
  Range,
  slowMovers,
  yearlyClose,
} from "./finance";

const MONEY = '"$"#,##0;[Red]-"$"#,##0';
const PCT = "0.0%";
const DARK = "FF1E1E1E";
const SAND = "FFF8F0E4";

const MONTHS = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
const CHANNEL: Record<string, string> = { WEB: "Tienda web", MANUAL: "Venta directa" };
const EXPENSE_LABELS: Record<string, string> = {
  PUBLICIDAD: "Publicidad",
  ENVIOS: "Envíos",
  EMPAQUE: "Empaque",
  PLATAFORMAS: "Plataformas / software",
  NOMINA: "Nómina / pagos",
  ARRIENDO: "Arriendo",
  SERVICIOS: "Servicios",
  OTROS: "Otros",
};

interface Col {
  header: string;
  key: string;
  width?: number;
  format?: "money" | "pct" | "int";
}

/** Hoja con encabezado oscuro, filtros, primera fila congelada y formatos de pesos/% */
function table(wb: ExcelJS.Workbook, name: string, cols: Col[], rows: Record<string, any>[], title?: string) {
  const ws = wb.addWorksheet(name, { views: [{ state: "frozen", ySplit: title ? 2 : 1 }] });
  let headerRow = 1;
  if (title) {
    ws.addRow([title]).font = { bold: true, size: 13 };
    headerRow = 2;
  }
  ws.columns = cols.map((c) => ({ key: c.key, width: c.width ?? Math.max(12, c.header.length + 2) }));
  const header = ws.getRow(headerRow);
  cols.forEach((c, i) => (header.getCell(i + 1).value = c.header));
  header.font = { bold: true, color: { argb: "FFFFFFFF" } };
  header.fill = { type: "pattern", pattern: "solid", fgColor: { argb: DARK } };

  rows.forEach((r) => ws.addRow(cols.map((c) => r[c.key] ?? null)));
  cols.forEach((c, i) => {
    const col = ws.getColumn(i + 1);
    if (c.format === "money") col.numFmt = MONEY;
    if (c.format === "pct") col.numFmt = PCT;
    if (c.format === "int") col.numFmt = "#,##0";
  });
  if (rows.length) {
    ws.autoFilter = { from: { row: headerRow, column: 1 }, to: { row: headerRow + rows.length, column: cols.length } };
  }
  return ws;
}

const KPI_ROWS: [keyof Kpis, string, "money" | "pct" | "int"][] = [
  ["revenue", "Ventas de prendas", "money"],
  ["shipping", "Envíos cobrados", "money"],
  ["grossSales", "Ingresos totales", "money"],
  ["cogs", "Costo de las prendas vendidas", "money"],
  ["grossProfit", "Utilidad bruta (ventas − costo)", "money"],
  ["grossMargin", "Margen bruto", "pct"],
  ["paymentFees", "Comisiones Wompi (estimadas)", "money"],
  ["expenses", "Gastos", "money"],
  ["netProfit", "Utilidad neta", "money"],
  ["margin", "Margen neto", "pct"],
  ["orders", "Número de ventas", "int"],
  ["units", "Prendas vendidas", "int"],
  ["avgTicket", "Ticket promedio", "money"],
  ["unitsWithoutCost", "Prendas vendidas sin costo registrado", "int"],
];

const closeCols = (first: Col): Col[] => [
  first,
  { header: "Ventas prendas", key: "revenue", format: "money", width: 16 },
  { header: "Envíos", key: "shipping", format: "money" },
  { header: "Costo prendas", key: "cogs", format: "money", width: 16 },
  { header: "Utilidad bruta", key: "grossProfit", format: "money", width: 16 },
  { header: "Comisiones", key: "paymentFees", format: "money" },
  { header: "Gastos", key: "expenses", format: "money" },
  { header: "Utilidad neta", key: "netProfit", format: "money", width: 16 },
  { header: "Margen neto", key: "margin", format: "pct" },
  { header: "Ventas", key: "orders", format: "int" },
  { header: "Prendas", key: "units", format: "int" },
  { header: "Ticket promedio", key: "avgTicket", format: "money", width: 16 },
];

const MONTHS_SHORT = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
const PAYMENT: Record<string, string> = {
  EFECTIVO: "Efectivo", TRANSFERENCIA: "Transferencia", NEQUI: "Nequi", DAVIPLATA: "Daviplata", DATAFONO: "Datáfono",
  OTRO: "Otro", CARD: "Tarjeta (Wompi)", PSE: "PSE (Wompi)", BANCOLOMBIA_TRANSFER: "Botón Bancolombia",
  BANCOLOMBIA_QR: "QR Bancolombia", "SIN DATO": "Sin dato",
};
const periodLabel = (p: string) => {
  const [y, m, d] = p.split("-").map(Number);
  return d ? `${d} ${MONTHS_SHORT[m - 1].toLowerCase()}` : `${MONTHS_SHORT[m - 1]} ${String(y).slice(2)}`;
};

/** Descripción legible de los filtros aplicados */
async function describeFilters(range: Range) {
  const parts: string[] = [];
  if (range.channel) parts.push(`Canal: ${CHANNEL[range.channel]}`);
  if (range.payment) parts.push(`Medio de pago: ${PAYMENT[range.payment] || range.payment}`);
  if (range.categoryId) {
    const [c] = await AppDataSource.query(`SELECT name FROM category WHERE id = $1`, [range.categoryId]);
    parts.push(`Categoría: ${c?.name ?? range.categoryId}`);
  }
  if (range.productId) {
    const [p] = await AppDataSource.query(`SELECT name FROM product WHERE id = $1`, [range.productId]);
    parts.push(`Prenda: ${p?.name ?? range.productId}`);
  }
  return parts.length ? parts.join(" · ") : "Sin filtros (todo el negocio)";
}

/** Pega una imagen PNG en la hoja, ocupando aproximadamente `cols` columnas */
function addImage(wb: ExcelJS.Workbook, ws: ExcelJS.Worksheet, png: Buffer, row: number, col: number, width: number, height: number) {
  const id = wb.addImage({ buffer: png as any, extension: "png" });
  ws.addImage(id, { tl: { col, row }, ext: { width, height } });
}

export async function buildWorkbook(range: Range) {
  const year = parseInt(range.to.slice(0, 4), 10);
  const filters = { channel: range.channel, payment: range.payment, categoryId: range.categoryId, productId: range.productId };
  const filtered = hasFilters(range);
  const [kpis, previous, series, breakdowns, sales, expenses, monthly, yearly, slow, products] = await Promise.all([
    computeKpis(range),
    computeKpis(previousRange(range)),
    computeSeries(range),
    computeBreakdowns(range),
    listSales(range),
    filtered
      ? Promise.resolve([] as Expense[])
      : AppDataSource.getRepository(Expense)
          .createQueryBuilder("e")
          .where("e.date >= :from AND e.date <= :to", { from: range.from, to: range.to })
          .orderBy("e.date", "ASC")
          .getMany(),
    monthlyClose(year, filters),
    yearlyClose(filters),
    slowMovers(range),
    (() => {
      const qb = AppDataSource.getRepository(Product)
        .createQueryBuilder("p")
        .addSelect("p.cost")
        .leftJoinAndSelect("p.category", "category")
        .leftJoinAndSelect("p.sizes", "sizes")
        .orderBy("p.name", "ASC");
      if (range.categoryId) qb.andWhere("p.categoryId = :c", { c: range.categoryId });
      if (range.productId) qb.andWhere("p.id = :p", { p: range.productId });
      return qb.getMany();
    })(),
  ]);
  const filterText = await describeFilters(range);

  const wb = new ExcelJS.Workbook();
  wb.creator = "Nova FIT";
  wb.created = new Date();

  // 1. Resumen
  const prev = previousRange(range);
  const ws = wb.addWorksheet("Resumen");
  ws.columns = [{ width: 40 }, { width: 18 }, { width: 18 }, { width: 14 }];
  ws.addRow(["Nova FIT · Reporte financiero"]).font = { bold: true, size: 14 };
  ws.addRow([`Periodo: ${range.from} a ${range.to}`]);
  ws.addRow([`Comparado con: ${prev.from} a ${prev.to}`]);
  ws.addRow([`Filtros: ${filterText}`]).font = { bold: filtered };
  ws.addRow([]);
  const h = ws.addRow(["Indicador", "Periodo", "Periodo anterior", "Variación"]);
  h.font = { bold: true, color: { argb: "FFFFFFFF" } };
  h.fill = { type: "pattern", pattern: "solid", fgColor: { argb: DARK } };
  for (const [key, label, format] of KPI_ROWS) {
    const cur = kpis[key];
    const before = previous[key];
    const variation = !before ? null : format === "pct" ? cur - before : (cur - before) / Math.abs(before);
    const row = ws.addRow([label, cur, before, variation]);
    const fmt = format === "money" ? MONEY : format === "pct" ? PCT : "#,##0";
    row.getCell(2).numFmt = fmt;
    row.getCell(3).numFmt = fmt;
    row.getCell(4).numFmt = format === "pct" ? '+0.0" pts";-0.0" pts"' : "+0.0%;-0.0%";
    if (format === "pct" && variation !== null) row.getCell(4).value = variation * 100;
    if (key === "netProfit") row.font = { bold: true };
  }
  ws.addRow([]);
  ws.addRow(["Notas"]).font = { bold: true };
  ws.addRow(["• Comisiones Wompi estimadas con la tarifa configurada (porcentaje + fijo + IVA) sobre ventas web."]);
  ws.addRow(["• El costo de cada venta es el registrado al vender; ventas antiguas usan el costo actual del producto."]);
  ws.addRow(["• No incluye ventas canceladas ni ventas directas anuladas."]);
  if (filtered) {
    ws.addRow(["• Con filtros, los gastos del negocio no se restan (no pertenecen a una prenda o canal); envío y comisión se reparten en proporción a lo vendido."]);
  }

  // 1b. Gráficas
  const charts = wb.addWorksheet("Gráficas", { views: [{ showGridLines: false }] });
  charts.getColumn(1).width = 2;
  charts.addRow([`Gráficas · ${range.from} a ${range.to} · ${filterText}`]).font = { bold: true, size: 13 };
  const unitsText = (r: any) => `${r.units} unid. · $${r.revenue.toLocaleString("es-CO")}`;
  const moneyText = (r: any) => `$${r.revenue.toLocaleString("es-CO")}${r.orders !== undefined ? ` · ${r.orders} ventas` : ""}`;
  const chartImages: [Buffer, number, number, number, number][] = [
    [
      await groupedBarChart({
        title: `Ventas y utilidad neta por ${series.groupBy === "day" ? "día" : "mes"}`,
        labels: series.points.map((p) => periodLabel(p.period)),
        series: [
          { name: "Ventas de prendas", color: COLOR_SALES, values: series.points.map((p) => p.revenue) },
          { name: "Utilidad neta", color: COLOR_PROFIT, values: series.points.map((p) => p.netProfit) },
        ],
      }),
      2, 1, 900, 340,
    ],
    [
      await groupedBarChart({
        title: `Cierre mensual ${year}`,
        labels: MONTHS_SHORT,
        series: [
          { name: "Ventas de prendas", color: COLOR_SALES, values: monthly.months.map((m) => m.revenue) },
          { name: "Utilidad neta", color: COLOR_PROFIT, values: monthly.months.map((m) => m.netProfit) },
        ],
      }),
      21, 1, 900, 340,
    ],
    [
      await horizontalBarChart({
        title: "Prendas más vendidas",
        rows: breakdowns.topProducts.map((r: any) => ({ label: r.name, value: r.units, text: unitsText(r) })),
      }),
      40, 1, 560, 0,
    ],
    [
      await horizontalBarChart({
        title: "Ventas por talla",
        rows: breakdowns.bySize.map((r: any) => ({ label: r.name, value: r.units, text: unitsText(r) })),
      }),
      40, 10, 560, 0,
    ],
    [
      await horizontalBarChart({
        title: "Ventas por categoría",
        rows: breakdowns.byCategory.map((r: any) => ({ label: r.name, value: r.revenue, text: moneyText(r) })),
      }),
      63, 1, 560, 0,
    ],
    [
      await horizontalBarChart({
        title: "Ventas por medio de pago",
        rows: breakdowns.byPayment.map((r: any) => ({ label: PAYMENT[r.name] || r.name, value: r.revenue, text: moneyText(r) })),
      }),
      63, 10, 560, 0,
    ],
    [
      await horizontalBarChart({
        title: "Ventas por canal",
        rows: breakdowns.byChannel.map((r: any) => ({ label: CHANNEL[r.name] || r.name, value: r.revenue, text: moneyText(r) })),
      }),
      86, 1, 560, 0,
    ],
    [
      await horizontalBarChart({
        title: filtered ? "Gastos (no aplica con filtros)" : "Gastos por categoría",
        rows: breakdowns.expensesByCategory.map((r: any) => ({ label: EXPENSE_LABELS[r.name] || r.name, value: r.total })),
        color: COLOR_PROFIT,
      }),
      86, 10, 560, 0,
    ],
  ];
  for (const [png, row, col, width, height] of chartImages) {
    // Altura real de la imagen (las de barras horizontales dependen del número de filas)
    const meta = await import("sharp").then((m) => m.default(png).metadata());
    const h = height || Math.round(((meta.height || 300) / (meta.width || 560)) * width);
    addImage(wb, charts, png, row, col, width, h);
  }

  // 2. Por periodo
  table(
    wb,
    series.groupBy === "day" ? "Por día" : "Por mes",
    [
      { header: series.groupBy === "day" ? "Día" : "Mes", key: "period", width: 12 },
      { header: "Ventas prendas", key: "revenue", format: "money", width: 16 },
      { header: "Utilidad neta", key: "netProfit", format: "money", width: 16 },
      { header: "Ventas", key: "orders", format: "int" },
      { header: "Prendas", key: "units", format: "int" },
    ],
    series.points
  );

  // 3. Ventas detalladas (una fila por prenda vendida)
  const saleRows = sales.flatMap((s) =>
    s.items.map((i) => ({
      // Excel no maneja zonas horarias: se escribe la hora de Colombia
      date: s.paidAt ? new Date(new Date(s.paidAt).getTime() - 5 * 3600_000) : null,
      reference: s.reference,
      channel: CHANNEL[s.channel] || s.channel,
      status: s.status === "APPROVED" ? (s.fulfillmentStatus === "CANCELADO" ? "Cancelada" : "Pagada") : "Anulada",
      customer: s.customerName,
      city: [s.city, s.department].filter(Boolean).join(", "),
      payment: s.paymentMethod,
      product: i.productName,
      size: i.size,
      quantity: i.quantity,
      unitPrice: i.unitPrice,
      subtotal: i.unitPrice * i.quantity,
      unitCost: i.unitCost,
      cost: i.unitCost === null ? null : i.unitCost * i.quantity,
      profit: i.profit,
    }))
  );
  const salesWs = table(
    wb,
    "Ventas",
    [
      { header: "Fecha", key: "date", width: 18 },
      { header: "Referencia", key: "reference", width: 22 },
      { header: "Canal", key: "channel", width: 14 },
      { header: "Estado", key: "status", width: 11 },
      { header: "Cliente", key: "customer", width: 22 },
      { header: "Ciudad", key: "city", width: 22 },
      { header: "Medio de pago", key: "payment", width: 16 },
      { header: "Prenda", key: "product", width: 28 },
      { header: "Talla", key: "size", width: 8 },
      { header: "Cant.", key: "quantity", format: "int", width: 8 },
      { header: "Precio unit.", key: "unitPrice", format: "money", width: 14 },
      { header: "Subtotal", key: "subtotal", format: "money", width: 14 },
      { header: "Costo unit.", key: "unitCost", format: "money", width: 14 },
      { header: "Costo total", key: "cost", format: "money", width: 14 },
      { header: "Utilidad", key: "profit", format: "money", width: 14 },
    ],
    saleRows
  );
  salesWs.getColumn(1).numFmt = "dd/mm/yyyy hh:mm";

  // 4. Productos
  const productCols: Col[] = [
    { header: "Prenda", key: "name", width: 30 },
    { header: "Prendas vendidas", key: "units", format: "int", width: 16 },
    { header: "Ventas", key: "revenue", format: "money", width: 16 },
    { header: "Utilidad bruta", key: "profit", format: "money", width: 16 },
  ];
  table(wb, "Más vendidos", productCols, breakdowns.topProducts, "Top 10 por unidades vendidas");
  table(wb, "Más rentables", productCols, breakdowns.mostProfitable, "Top 5 por utilidad bruta");
  table(
    wb,
    "Sin ventas",
    [
      { header: "Prenda", key: "name", width: 30 },
      { header: "Stock", key: "stock", format: "int" },
      { header: "Precio", key: "price", format: "money" },
      { header: "Costo", key: "cost", format: "money" },
    ],
    slow,
    "Prendas activas con stock que no se vendieron en el periodo"
  );

  // 5. Desgloses
  const groupCols = (first: string): Col[] => [
    { header: first, key: "name", width: 24 },
    { header: "Prendas", key: "units", format: "int" },
    { header: "Ventas", key: "revenue", format: "money", width: 16 },
    { header: "Utilidad bruta", key: "profit", format: "money", width: 16 },
  ];
  table(wb, "Por talla", groupCols("Talla"), breakdowns.bySize);
  table(wb, "Por categoría", groupCols("Categoría"), breakdowns.byCategory);
  table(
    wb,
    "Por canal y pago",
    [{ header: "Canal / medio de pago", key: "name", width: 26 }, { header: "Ventas (#)", key: "orders", format: "int" }, ...groupCols("").slice(1)],
    [
      ...breakdowns.byChannel.map((r: any) => ({ ...r, name: CHANNEL[r.name] || r.name })),
      {},
      ...breakdowns.byPayment,
    ]
  );
  table(
    wb,
    "Por departamento",
    [{ header: "Departamento", key: "name", width: 24 }, { header: "Ventas (#)", key: "orders", format: "int" }, ...groupCols("").slice(1)],
    breakdowns.byDepartment
  );

  // 6. Gastos
  if (filtered) {
    wb.addWorksheet("Gastos").addRow(["Los gastos no se filtran por canal, prenda, categoría ni medio de pago. Genera el Excel sin filtros para verlos."]);
  } else table(
    wb,
    "Gastos",
    [
      { header: "Fecha", key: "date", width: 12 },
      { header: "Categoría", key: "category", width: 22 },
      { header: "Descripción", key: "description", width: 40 },
      { header: "Valor", key: "amount", format: "money", width: 14 },
    ],
    expenses.map((e) => ({ ...e, category: EXPENSE_LABELS[e.category] || e.category }))
  );

  // 7. Cierres
  const monthlyWs = table(
    wb,
    `Cierre mensual ${year}`,
    closeCols({ header: "Mes", key: "label", width: 12 }),
    [...monthly.months.map((m) => ({ ...m, label: MONTHS[m.month - 1] })), { ...monthly.total, label: `Total ${year}` }]
  );
  monthlyWs.lastRow!.font = { bold: true };
  monthlyWs.lastRow!.fill = { type: "pattern", pattern: "solid", fgColor: { argb: SAND } };
  table(wb, "Cierre anual", closeCols({ header: "Año", key: "year", width: 10 }), yearly);

  // 8. Inventario
  const sizeOrder = ["XS", "S", "M", "L", "XL", "XXL"];
  const rank = (size: string) => (sizeOrder.indexOf(size) + 1 || 99);
  const inventory = products.flatMap((p) =>
    [...p.sizes].sort((a, b) => rank(a.size) - rank(b.size)).map((s) => {
      const cost = p.cost === null || p.cost === undefined ? null : Math.round(Number(p.cost));
      const price = Math.round(Number(p.price));
      return {
        name: p.name,
        category: p.category?.name || "",
        active: p.isActive ? "Sí" : "No",
        size: s.size,
        stock: s.stock,
        price,
        cost,
        valueAtCost: cost === null ? null : cost * s.stock,
        valueAtPrice: price * s.stock,
      };
    })
  );
  table(
    wb,
    "Inventario",
    [
      { header: "Prenda", key: "name", width: 30 },
      { header: "Categoría", key: "category", width: 16 },
      { header: "Activo", key: "active", width: 8 },
      { header: "Talla", key: "size", width: 8 },
      { header: "Stock", key: "stock", format: "int" },
      { header: "Precio", key: "price", format: "money" },
      { header: "Costo", key: "cost", format: "money" },
      { header: "Valor a costo", key: "valueAtCost", format: "money", width: 16 },
      { header: "Valor a precio de venta", key: "valueAtPrice", format: "money", width: 22 },
    ],
    inventory,
    `Inventario actual (${new Date().toLocaleDateString("es-CO", { timeZone: "America/Bogota" })})`
  );

  return wb;
}
