import { Request, Response } from "express";
import { createRouter } from "../middleware/errors";
import { AppDataSource } from "../config/data-source";
import { InventoryMovement, Order, OrderItem, Product } from "../entities";
import { authMiddleware } from "../middleware/auth";
import { withImageUrls } from "./image.routes";
import { changeStock, setStock } from "../services/inventory";
import { expireStaleOrders } from "../services/orders";

const router = createRouter();
router.use(authMiddleware);

const key = (productId: number, size: string) => `${productId}|${size}`;

/** Suma unidades de pedidos web agrupadas por producto y talla */
async function unitsByLine(where: string, params: Record<string, unknown>) {
  const rows: { productId: number; size: string; units: string }[] = await AppDataSource.getRepository(OrderItem)
    .createQueryBuilder("item")
    .innerJoin(Order, "o", "o.id = item.orderId")
    .select("item.productId", "productId")
    .addSelect("item.size", "size")
    .addSelect("SUM(item.quantity)", "units")
    .where(where, params)
    .groupBy("item.productId")
    .addGroupBy("item.size")
    .getRawMany();
  const map: Record<string, number> = {};
  rows.forEach((r) => (map[key(Number(r.productId), r.size)] = Number(r.units)));
  return map;
}

/**
 * Inventario completo: cada producto con sus tallas, unidades apartadas por pedidos
 * pendientes de pago y unidades vendidas en la web en los últimos 30 días.
 */
router.get("/", async (req: Request, res: Response) => {
  await expireStaleOrders().catch((e) => console.error("expireStaleOrders", e?.message));

  const products = await AppDataSource.getRepository(Product).find({
    relations: ["category", "images", "sizes"],
    order: { name: "ASC" },
  });

  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const [reserved, sold30d] = await Promise.all([
    unitsByLine(`o.status = 'PENDING' AND o."stockReserved" = true`, {}),
    unitsByLine(`o.status = 'APPROVED' AND o."paidAt" >= :since`, { since }),
  ]);

  const sizeOrder = ["XS", "S", "M", "L", "XL", "XXL"];
  res.json(
    products.map((p) => {
      const withUrls = withImageUrls(req, p) as any;
      const main = withUrls.images?.find((i: any) => i.isMain) || withUrls.images?.[0];
      return {
        id: p.id,
        name: p.name,
        slug: p.slug,
        price: Number(p.price),
        isActive: p.isActive,
        category: p.category?.name || "",
        image: main?.imageData || null,
        sizes: [...p.sizes]
          .sort((a, b) => sizeOrder.indexOf(a.size) - sizeOrder.indexOf(b.size))
          .map((s) => ({
            size: s.size,
            stock: s.stock,
            reserved: reserved[key(p.id, s.size)] || 0,
            sold30d: sold30d[key(p.id, s.size)] || 0,
          })),
      };
    })
  );
});

/** Entrada, salida o ajuste por conteo de una talla */
router.post("/adjust", async (req: Request, res: Response) => {
  const { productId, size, type, quantity, note } = req.body || {};
  const qty = Math.trunc(Number(quantity));
  if (!["ENTRADA", "SALIDA", "AJUSTE"].includes(type)) {
    return res.status(400).json({ message: "Tipo de movimiento no válido" });
  }
  if (!Number.isFinite(qty) || qty < 0 || (type !== "AJUSTE" && qty === 0) || qty > 100000) {
    return res.status(400).json({ message: "Cantidad no válida" });
  }

  const product = await AppDataSource.getRepository(Product).findOne({
    where: { id: parseInt(productId, 10) },
    loadEagerRelations: false,
  });
  if (!product) return res.status(404).json({ message: "Producto no encontrado" });

  const base = {
    productId: product.id,
    productName: product.name,
    size: String(size || ""),
    type,
    note: String(note || "").trim().slice(0, 300),
  };

  const stock = await AppDataSource.transaction((manager) =>
    type === "AJUSTE"
      ? setStock(manager, { ...base, stock: qty })
      : changeStock(manager, { ...base, delta: type === "ENTRADA" ? qty : -qty, mode: "strict" })
  );

  if (stock === null) {
    return res.status(type === "SALIDA" ? 409 : 404).json({
      message: type === "SALIDA" ? "No hay unidades suficientes en esa talla" : "Talla no encontrada",
    });
  }
  res.json({ productId: product.id, size: base.size, stock });
});

/** Historial de movimientos (más recientes primero) */
router.get("/movements", async (req: Request, res: Response) => {
  const qb = AppDataSource.getRepository(InventoryMovement)
    .createQueryBuilder("m")
    .orderBy("m.createdAt", "DESC")
    .addOrderBy("m.id", "DESC")
    .take(Math.min(parseInt((req.query.limit as string) || "200", 10) || 200, 1000));

  if (req.query.productId) {
    qb.andWhere("m.productId = :productId", { productId: parseInt(req.query.productId as string, 10) });
  }
  if (req.query.type) qb.andWhere("m.type = :type", { type: String(req.query.type) });

  res.json(await qb.getMany());
});

export default router;
