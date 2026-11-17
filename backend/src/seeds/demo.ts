/**
 * Datos de DEMOSTRACIÓN para probar Finanzas, Inventario y Pedidos en local.
 *
 *   npm run seed:demo            → borra la demo anterior y carga una nueva
 *   npm run seed:demo -- --borrar → solo borra los datos de demo
 *
 * Todo lo que crea queda marcado y se puede borrar sin tocar tus datos reales:
 *   productos con slug "demo-…", pedidos con referencia "DEMO-…",
 *   gastos que empiezan por "[DEMO]".
 * No usar contra la base de producción.
 */
import "reflect-metadata";
import { In, Like } from "typeorm";
import { AppDataSource } from "../config/data-source";
import {
  Category,
  Expense,
  InventoryMovement,
  Order,
  OrderItem,
  Product,
  ProductImage,
  ProductSize,
} from "../entities";

// ---------- utilidades ----------

// Generador pseudoaleatorio con semilla: la demo sale igual cada vez
let seedState = 20261111;
const rand = () => {
  seedState = (seedState * 1664525 + 1013904223) % 4294967296;
  return seedState / 4294967296;
};
const pick = <T>(arr: T[]): T => arr[Math.floor(rand() * arr.length)];
const between = (min: number, max: number) => Math.floor(min + rand() * (max - min + 1));
const weighted = <T>(items: [T, number][]): T => {
  const total = items.reduce((s, [, w]) => s + w, 0);
  let r = rand() * total;
  for (const [item, w] of items) if ((r -= w) <= 0) return item;
  return items[items.length - 1][0];
};

const BOGOTA_OFFSET_MS = 5 * 3600_000;
const todayCo = () => new Date(Date.now() - BOGOTA_OFFSET_MS).toISOString().slice(0, 10);
/** Fecha/hora de Colombia → Date (UTC) */
const coDate = (day: string, hour: number, minute: number) =>
  new Date(`${day}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00-05:00`);
const addDays = (day: string, n: number) => {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

/** Imagen de relleno (SVG) con el color y el nombre de la prenda */
function placeholder(name: string, color: string) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="800" viewBox="0 0 600 800">
<rect width="600" height="800" fill="${color}"/>
<path d="M210 170 L390 170 L430 330 L400 650 L320 650 L300 420 L280 650 L200 650 L170 330 Z" fill="rgba(255,255,255,0.28)"/>
<text x="300" y="730" font-family="Arial, sans-serif" font-size="34" fill="#ffffff" text-anchor="middle">${name}</text>
<text x="300" y="90" font-family="Arial, sans-serif" font-size="22" fill="rgba(255,255,255,0.8)" text-anchor="middle" letter-spacing="6">DEMO</text>
</svg>`;
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
}

// ---------- catálogo de demo ----------

const SIZES = ["XS", "S", "M", "L", "XL"];
// [nombre, categoría, precio, costo (null = sin costo para ver la alerta), color, popularidad]
const CATALOG: [string, string, number, number | null, string, number][] = [
  ["Set Brisa", "Sets", 159900, 68000, "#b59677", 9],
  ["Set Aurora", "Sets", 174900, 76000, "#8c6b5d", 6],
  ["Set Coral", "Sets", 149900, 61000, "#d98b73", 4],
  ["Vestido Luna", "Vestidos", 129900, 52000, "#3d3d4e", 7],
  ["Vestido Sol", "Vestidos", 139900, 58000, "#c9a227", 3],
  ["Body Nube", "Bodys", 79900, 29000, "#e6e0d8", 10],
  ["Body Noche", "Bodys", 84900, 31000, "#1e1e1e", 5],
  ["Blusa Arena", "Blusas", 69900, 24000, "#d8c3a5", 8],
  ["Blusa Marea", "Blusas", 64900, null, "#6b8fa3", 4],
  ["Jean Clásico", "Jeans", 119900, 47000, "#41597a", 6],
  ["Jean Mom", "Jeans", 124900, null, "#5b7290", 2],
  ["Falda Lino", "Faldas", 89900, 33000, "#a3b18a", 1],
];

const DEPARTMENTS: [string, string, number][] = [
  ["Valle del Cauca", "Cali", 40],
  ["Valle del Cauca", "Palmira", 6],
  ["Bogotá D.C.", "Bogotá", 18],
  ["Antioquia", "Medellín", 12],
  ["Atlántico", "Barranquilla", 6],
  ["Cauca", "Popayán", 6],
  ["Risaralda", "Pereira", 5],
  ["Santander", "Bucaramanga", 4],
  ["Nariño", "Pasto", 3],
];
const FIRST = ["Laura", "Valentina", "Camila", "Daniela", "Sofía", "Mariana", "Juliana", "Natalia", "Paula", "Andrea", "Carolina", "Isabella", "Manuela", "Sara", "Luisa"];
const LAST = ["Gómez", "Rodríguez", "Martínez", "López", "García", "Hernández", "Ramírez", "Torres", "Castillo", "Vargas", "Rojas", "Muñoz"];

// ---------- borrar demo ----------

async function removeDemo() {
  const products = await AppDataSource.getRepository(Product).find({
    where: { slug: Like("demo-%") },
    select: ["id"],
    loadEagerRelations: false,
  });
  const ids = products.map((p) => p.id);
  await AppDataSource.transaction(async (m) => {
    const orders = await m.find(Order, { where: { reference: Like("DEMO-%") }, select: ["id"], loadEagerRelations: false });
    if (orders.length) await m.delete(OrderItem, { orderId: In(orders.map((o) => o.id)) });
    await m.delete(Order, { reference: Like("DEMO-%") });
    await m.delete(InventoryMovement, { reference: Like("DEMO-%") });
    if (ids.length) {
      await m.delete(InventoryMovement, { productId: In(ids) });
      await m.delete(Product, { id: In(ids) });
    }
    await m.delete(Expense, { description: Like("[DEMO]%") });
  });
  console.log(`Demo anterior borrada (${ids.length} productos).`);
}

// ---------- cargar demo ----------

async function loadDemo() {
  const today = todayCo();
  const start = `${today.slice(0, 4)}-01-01`;

  // Categorías: usa las que existan con ese nombre; si no, las crea
  const catRepo = AppDataSource.getRepository(Category);
  const categories = new Map<string, Category>();
  for (const name of [...new Set(CATALOG.map((c) => c[1]))]) {
    const slug = name.toLowerCase();
    let cat = await catRepo.findOne({ where: [{ slug }, { name }] });
    if (!cat) cat = await catRepo.save(catRepo.create({ name, slug, isActive: true }));
    categories.set(name, cat);
  }

  // 1) Simular las ventas del año (para saber cuánto stock inicial hace falta)
  interface Line { product: number; size: string; quantity: number; unitPrice: number; }
  interface SimOrder {
    reference: string; channel: "WEB" | "MANUAL"; status: "APPROVED" | "PENDING"; paidAt: Date | null; createdAt: Date;
    lines: Line[]; dept: string; city: string; name: string; payment: string; fulfillment: string; cancelled: boolean;
  }
  const sims: SimOrder[] = [];
  const totalDays = Math.round((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / 86_400_000);
  let counter = 0;

  for (let d = 0; d <= totalDays; d++) {
    const day = addDays(start, d);
    const month = parseInt(day.slice(5, 7), 10);
    const weekday = new Date(`${day}T12:00:00Z`).getUTCDay();
    // El negocio crece durante el año; picos en mayo (día de la madre) y noviembre; fines de semana venden más
    const growth = 0.35 + (d / Math.max(1, totalDays)) * 0.9;
    const season = month === 5 ? 1.6 : month === 12 ? 1.8 : month === 11 ? 1.3 : month === 2 ? 0.8 : 1;
    const weekend = weekday === 0 || weekday === 6 ? 1.4 : 1;
    const expected = 1.1 * growth * season * weekend;
    const ordersToday = Math.floor(expected) + (rand() < expected % 1 ? 1 : 0);

    for (let k = 0; k < ordersToday; k++) {
      const hour = between(8, 22);
      const minute = between(0, 59);
      const when = coDate(day, hour, minute);
      if (when.getTime() > Date.now()) continue;
      const isWeb = rand() < 0.68;
      const lines: Line[] = [];
      const count = weighted([[1, 60], [2, 30], [3, 10]]);
      for (let i = 0; i < count; i++) {
        const product = weighted(CATALOG.map((c, idx) => [idx, c[5]] as [number, number]));
        const size = weighted([["XS", 8], ["S", 26], ["M", 34], ["L", 22], ["XL", 10]]);
        const existing = lines.find((l) => l.product === product && l.size === size);
        if (existing) { existing.quantity++; continue; }
        const price = CATALOG[product][2];
        // Ventas directas a veces con descuento
        const unitPrice = !isWeb && rand() < 0.3 ? Math.round((price * 0.9) / 1000) * 1000 : price;
        lines.push({ product, size, quantity: 1, unitPrice });
      }
      const [dept, city] = weighted(DEPARTMENTS.map(([dp, c, w]) => [[dp, c], w] as [[string, string], number]));
      const ageDays = totalDays - d;
      const pending = isWeb && ageDays === 0 && rand() < 0.25;
      sims.push({
        reference: `DEMO-${isWeb ? "W" : "M"}-${String(++counter).padStart(4, "0")}`,
        channel: isWeb ? "WEB" : "MANUAL",
        status: pending ? "PENDING" : "APPROVED",
        paidAt: pending ? null : when,
        createdAt: new Date(when.getTime() - between(2, 15) * 60_000),
        lines,
        dept: isWeb ? dept : rand() < 0.7 ? "Valle del Cauca" : dept,
        city: isWeb ? city : rand() < 0.7 ? "Cali" : city,
        name: `${pick(FIRST)} ${pick(LAST)}`,
        payment: isWeb
          ? weighted([["CARD", 35], ["PSE", 25], ["NEQUI", 30], ["BANCOLOMBIA_TRANSFER", 10]])
          : weighted([["NEQUI", 40], ["TRANSFERENCIA", 25], ["EFECTIVO", 25], ["DAVIPLATA", 10]]),
        fulfillment: !isWeb ? "ENTREGADO" : ageDays > 6 ? "ENTREGADO" : ageDays > 2 ? "DESPACHADO" : "POR_DESPACHAR",
        cancelled: isWeb && !pending && rand() < 0.02,
      });
    }
  }

  // Stock final deseado por talla (algunas agotadas y otras bajas para ver las alertas)
  const sold = new Map<string, number>();
  for (const o of sims) {
    if (o.cancelled) continue;
    for (const l of o.lines) sold.set(`${l.product}|${l.size}`, (sold.get(`${l.product}|${l.size}`) || 0) + l.quantity);
  }
  const finalStock = (p: number, s: string) => {
    const r = rand();
    if (r < 0.08) return 0;
    if (r < 0.2) return between(1, 3);
    return between(4, 18) + (s === "M" ? 4 : 0);
  };

  // 2) Productos con imagen, tallas y stock inicial
  const productIds: number[] = [];
  const running = new Map<string, number>();
  const movements: Partial<InventoryMovement>[] = [];
  const firstDay = coDate(start, 8, 0);

  for (const [idx, [name, catName, price, cost, color]] of CATALOG.entries()) {
    const sizes = SIZES.map((size) => {
      const initial = (sold.get(`${idx}|${size}`) || 0) + finalStock(idx, size);
      running.set(`${idx}|${size}`, initial);
      return { size, stock: initial };
    });
    const product = await AppDataSource.getRepository(Product).save(
      AppDataSource.getRepository(Product).create({
        name,
        slug: `demo-${name.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, "-")}`,
        description: `${name}: prenda de demostración para probar la tienda.`,
        price,
        cost,
        categoryId: categories.get(catName)!.id,
        isActive: true,
        images: [{ imageData: placeholder(name, color), mimeType: "image/svg+xml", isMain: true } as ProductImage],
        sizes: sizes as ProductSize[],
      })
    );
    productIds.push(product.id);
    for (const s of sizes) {
      movements.push({
        productId: product.id, productName: name, size: s.size, type: "CREACION",
        quantity: s.stock, stockAfter: s.stock, note: "Stock inicial (demo)", createdAt: firstDay,
      });
    }
  }

  // 3) Pedidos y ventas, con su movimiento de inventario
  const orderRepo = AppDataSource.getRepository(Order);
  const shippingCost = 12000;
  for (const o of sims.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())) {
    const items = o.lines.map((l) => ({
      productId: productIds[l.product],
      productName: CATALOG[l.product][0],
      size: l.size,
      quantity: l.quantity,
      unitPrice: l.unitPrice,
      unitCost: CATALOG[l.product][3],
    }));
    const subtotal = items.reduce((s, i) => s + i.unitPrice * i.quantity, 0);
    const shipping = o.channel === "WEB" ? (subtotal >= 250000 ? 0 : shippingCost) : rand() < 0.3 ? 8000 : 0;
    const phone = `3${between(0, 2)}${between(0, 9)}${String(between(1000000, 9999999))}`;

    await orderRepo.save(
      orderRepo.create({
        reference: o.reference,
        channel: o.channel,
        status: o.status,
        fulfillmentStatus: o.cancelled ? "CANCELADO" : o.fulfillment,
        trackingNumber: o.channel === "WEB" && o.fulfillment !== "POR_DESPACHAR" ? `INT${between(100000000, 999999999)}` : undefined,
        customerName: o.name,
        email: o.channel === "WEB" ? `${o.name.split(" ")[0].toLowerCase()}${between(1, 99)}@demo.co` : undefined,
        phone,
        department: o.dept,
        city: o.city,
        address: o.channel === "WEB" ? `Calle ${between(1, 120)} # ${between(1, 99)}-${between(1, 99)}` : undefined,
        subtotal,
        shippingCost: shipping,
        total: subtotal + shipping,
        paymentMethod: o.payment,
        wompiTransactionId: o.channel === "WEB" && o.status === "APPROVED" ? `demo-${between(10000, 99999)}-${o.reference}` : undefined,
        stockReserved: !o.cancelled,
        paidAt: o.paidAt,
        createdAt: o.createdAt,
        items: items as OrderItem[],
      } as Partial<Order>)
    );

    if (o.cancelled) continue;
    for (const i of items) {
      const key = `${CATALOG.findIndex((c) => c[0] === i.productName)}|${i.size}`;
      const after = (running.get(key) || 0) - i.quantity;
      running.set(key, after);
      movements.push({
        productId: i.productId, productName: i.productName, size: i.size,
        type: o.channel === "WEB" ? "VENTA_WEB" : "VENTA_MANUAL",
        quantity: -i.quantity, stockAfter: after, reference: o.reference, createdAt: o.createdAt,
      });
    }
  }

  await AppDataSource.getRepository(InventoryMovement).insert(movements as InventoryMovement[]);

  // Stock actual = stock inicial − lo vendido
  for (const [key, stock] of running) {
    const [idx, size] = key.split("|");
    await AppDataSource.getRepository(ProductSize).update({ productId: productIds[Number(idx)], size }, { stock });
  }

  // 4) Gastos de cada mes
  const expenses: Partial<Expense>[] = [];
  for (let m = 1; m <= parseInt(today.slice(5, 7), 10); m++) {
    const month = `${today.slice(0, 4)}-${String(m).padStart(2, "0")}`;
    const lastDay = m === parseInt(today.slice(5, 7), 10) ? parseInt(today.slice(8, 10), 10) : 28;
    const day = (n: number) => `${month}-${String(Math.min(n, lastDay)).padStart(2, "0")}`;
    const growth = 0.6 + (m / 12) * 0.8;
    expenses.push(
      { date: day(3), category: "PUBLICIDAD", description: "[DEMO] Meta Ads - campaña del mes", amount: Math.round((180000 * growth) / 1000) * 1000 },
      { date: day(5), category: "PLATAFORMAS", description: "[DEMO] Hosting y dominio", amount: 45000 },
      { date: day(12), category: "EMPAQUE", description: "[DEMO] Bolsas y etiquetas", amount: between(30, 70) * 1000 },
      { date: day(20), category: "ENVIOS", description: "[DEMO] Envíos por cambios de talla", amount: between(15, 45) * 1000 },
    );
    if (m === 5 || m === 11) {
      expenses.push({ date: day(8), category: "PUBLICIDAD", description: "[DEMO] Pauta extra temporada", amount: 250000 });
    }
    if (m % 3 === 0) {
      expenses.push({ date: day(15), category: "SERVICIOS", description: "[DEMO] Sesión de fotos", amount: 300000 });
    }
  }
  await AppDataSource.getRepository(Expense).insert(expenses as Expense[]);

  const approved = sims.filter((s) => s.status === "APPROVED" && !s.cancelled);
  console.log(`Demo cargada:
  • ${CATALOG.length} productos (2 sin costo, para ver la alerta)
  • ${approved.length} ventas desde ${start} (${approved.filter((s) => s.channel === "WEB").length} web, ${approved.filter((s) => s.channel === "MANUAL").length} directas)
  • ${sims.filter((s) => s.cancelled).length} canceladas · ${sims.filter((s) => s.status === "PENDING").length} pendientes de pago
  • ${expenses.length} gastos
  • ${movements.length} movimientos de inventario`);
}

async function main() {
  await AppDataSource.initialize();
  const url = process.env.DATABASE_URL || "";
  if (/railway|neon|render|amazonaws|supabase/i.test(url)) {
    console.error("Parece una base en la nube. La demo es solo para la base local: abortado.");
    process.exit(1);
  }
  await removeDemo();
  if (!process.argv.includes("--borrar")) await loadDemo();
  await AppDataSource.destroy();
}

main().catch((e) => {
  console.error("Error cargando la demo:", e);
  process.exit(1);
});
