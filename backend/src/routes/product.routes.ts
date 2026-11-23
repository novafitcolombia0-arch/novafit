import { Request, Response } from "express";
import { createRouter } from "../middleware/errors";
import { AppDataSource } from "../config/data-source";
import { ONE_SIZE, Product, ProductColor, ProductImage, ProductSize } from "../entities";
import { logMovement } from "../services/inventory";
import { isDataUrl, withImageUrls } from "./image.routes";
import { authMiddleware } from "../middleware/auth";

const router = createRouter();
const productRepo = () => AppDataSource.getRepository(Product);

router.get("/", async (req: Request, res: Response) => {
  const { categoryId, search } = req.query;
  const qb = productRepo()
    .createQueryBuilder("product")
    .leftJoinAndSelect("product.category", "category")
    .leftJoinAndSelect("product.images", "images")
    .leftJoinAndSelect("product.sizes", "sizes")
    .where("product.isActive = :active", { active: true });

  if (categoryId) {
    qb.andWhere("product.categoryId = :categoryId", {
      categoryId: parseInt(categoryId as string),
    });
  }
  if (search) {
    qb.andWhere("product.name ILIKE :search", { search: `%${search}%` });
  }

  qb.orderBy("product.id", "DESC");
  const products = await qb.getMany();
  res.json(products.map((p) => withImageUrls(req, p)));
});

router.get("/all", authMiddleware, async (req: Request, res: Response) => {
  const products = await productRepo()
    .createQueryBuilder("product")
    .addSelect("product.cost")
    .leftJoinAndSelect("product.category", "category")
    .leftJoinAndSelect("product.images", "images")
    .leftJoinAndSelect("product.sizes", "sizes")
    .orderBy("product.id", "DESC")
    .getMany();
  res.json(products.map((p) => withImageUrls(req, p)));
});

router.get("/:slug", async (req: Request, res: Response) => {
  const product = await productRepo().findOne({
    where: { slug: req.params.slug as string },
    relations: ["category", "images", "sizes"],
  });
  if (!product)
    return res.status(404).json({ message: "Producto no encontrado" });
  res.json(withImageUrls(req, product));
});

// ---------- Colores, variantes (color + talla) y fotos ----------

const MAX_COLORS = 12;

/** Colores que manda el panel: nombre (obligatorio) y tono para el circulito de la tienda */
function parseColors(raw: unknown): ProductColor[] {
  if (!Array.isArray(raw)) return [];
  const colors: ProductColor[] = [];
  for (const c of raw) {
    const name = String(c?.name ?? "").trim().slice(0, 30);
    const hex = /^#[0-9a-f]{6}$/i.test(String(c?.hex ?? "")) ? String(c.hex).toLowerCase() : "#cccccc";
    if (name && !colors.some((x) => x.name.toLowerCase() === name.toLowerCase())) colors.push({ name, hex });
  }
  return colors.slice(0, MAX_COLORS);
}

interface Variant { color: string; size: string; stock: number }
const variantKey = (v: { color?: string | null; size: string }) => `${v.color || ""}|${v.size}`;
const variantLabel = (v: { color?: string | null; size: string }) => (v.color ? `${v.color} talla ${v.size}` : `Talla ${v.size}`);

/**
 * Variantes que manda el panel. Si la prenda maneja colores, cada variante debe ser de uno
 * de sus colores. Sin tallas, la prenda queda como "Talla única" (una por color).
 */
function parseVariants(raw: unknown, colors: ProductColor[]): Variant[] {
  const names = colors.map((c) => c.name);
  const variants = new Map<string, Variant>();
  for (const v of Array.isArray(raw) ? raw : []) {
    const size = String(v?.size ?? "").trim().slice(0, 20);
    const color = names.find((n) => n.toLowerCase() === String(v?.color ?? "").trim().toLowerCase()) || "";
    if (!size || (names.length && !color)) continue;
    const variant = { color, size, stock: Math.max(0, parseInt(v?.stock, 10) || 0) };
    if (!variants.has(variantKey(variant))) variants.set(variantKey(variant), variant);
  }
  if (!variants.size) {
    for (const color of names.length ? names : [""]) {
      variants.set(variantKey({ color, size: ONE_SIZE }), { color, size: ONE_SIZE, stock: 0 });
    }
  }
  return [...variants.values()];
}

/** Color de una foto: uno de los colores de la prenda, o "" (se ve con todos) */
const imageColor = (raw: unknown, colors: ProductColor[]) =>
  colors.find((c) => c.name.toLowerCase() === String(raw ?? "").trim().toLowerCase())?.name || "";

router.post("/", authMiddleware, async (req: Request, res: Response) => {
  const { name, slug, description, price, cost, categoryId, images, isActive } = req.body;
  if (!name || !slug || !price || !categoryId) {
    return res
      .status(400)
      .json({ message: "Nombre, slug, precio y categoría requeridos" });
  }

  const exists = await productRepo().findOne({ where: { slug } });
  if (exists)
    return res.status(400).json({ message: "Ya existe un producto con ese slug" });

  const colors = parseColors(req.body.colors);
  const variants = parseVariants(req.body.sizes, colors);
  const product = productRepo().create({
    name,
    slug,
    description,
    price,
    cost: cost === undefined || cost === null || cost === "" ? null : Math.max(0, Math.round(Number(cost))),
    categoryId,
    colors,
    isActive: isActive ?? true,
    images: (images || [])
      .filter((img: any) => isDataUrl(img.imageData))
      .map((img: any) => ({ imageData: img.imageData, mimeType: img.mimeType, isMain: !!img.isMain, color: imageColor(img.color, colors) })),
    sizes: variants as ProductSize[],
  });
  await productRepo().save(product);

  // Stock inicial al historial de inventario
  for (const sz of product.sizes || []) {
    if (sz.stock > 0) {
      await logMovement(AppDataSource.manager, {
        productId: product.id,
        productName: product.name,
        color: sz.color,
        size: sz.size,
        type: "CREACION",
        quantity: sz.stock,
        stockAfter: sz.stock,
        note: "Stock inicial del producto",
      });
    }
  }
  res.status(201).json(withImageUrls(req, product));
});

router.put("/:id", authMiddleware, async (req: Request, res: Response) => {
  const product = await productRepo().findOne({
    where: { id: parseInt(req.params.id as string) },
    relations: ["images", "sizes"],
  });
  if (!product)
    return res.status(404).json({ message: "Producto no encontrado" });

  const { images, sizes, cost } = req.body;
  // Solo los campos editables; id, relaciones u otros campos que lleguen se ignoran
  for (const key of ["name", "slug", "description", "price", "categoryId", "isActive"] as const) {
    if (req.body[key] !== undefined) (product as any)[key] = req.body[key];
  }
  if (cost !== undefined) {
    product.cost = cost === null || cost === "" ? null : Math.max(0, Math.round(Number(cost)));
  }
  if (req.body.colors !== undefined) product.colors = parseColors(req.body.colors);
  const colors = product.colors || [];

  if (images) {
    // El panel reenvía las imágenes existentes solo con su URL: se recuperan sus datos
    const imageRepo = AppDataSource.getRepository(ProductImage);
    const stored = await imageRepo
      .createQueryBuilder("image")
      .addSelect("image.imageData")
      .where("image.productId = :id", { id: product.id })
      .getMany();
    const kept = images
      .map((img: any) => {
        const extra = { isMain: !!img.isMain, color: imageColor(img.color, colors) };
        if (isDataUrl(img.imageData)) return { imageData: img.imageData, mimeType: img.mimeType, ...extra };
        const old = stored.find((s) => s.id === img.id);
        return old && { imageData: old.imageData, mimeType: old.mimeType, ...extra };
      })
      .filter(Boolean);
    await imageRepo.delete({ productId: product.id });
    product.images = kept.map((img: any) => imageRepo.create({ ...img, productId: product.id }));
  }

  if (Array.isArray(sizes) || req.body.colors !== undefined) {
    // Las variantes que ya existen conservan su stock real (se maneja desde Inventario y lo
    // descuentan las ventas web); aquí solo se agregan variantes nuevas o se quitan.
    const incoming = parseVariants(Array.isArray(sizes) ? sizes : product.sizes, colors);
    await AppDataSource.transaction(async (manager) => {
      const current = await manager.find(ProductSize, {
        where: { productId: product.id },
        loadEagerRelations: false,
      });
      const incomingKeys = new Set(incoming.map(variantKey));

      for (const row of current) {
        if (incomingKeys.has(variantKey(row))) continue;
        await manager.delete(ProductSize, row.id);
        if (row.stock > 0) {
          await logMovement(manager, {
            productId: product.id,
            productName: product.name,
            color: row.color,
            size: row.size,
            type: "ELIMINACION",
            quantity: -row.stock,
            stockAfter: 0,
            note: `${variantLabel(row)} eliminada del producto`,
          });
        }
      }

      for (const v of incoming) {
        if (current.some((row) => variantKey(row) === variantKey(v))) continue;
        await manager.insert(ProductSize, { productId: product.id, color: v.color, size: v.size, stock: v.stock });
        if (v.stock > 0) {
          await logMovement(manager, {
            productId: product.id,
            productName: product.name,
            color: v.color,
            size: v.size,
            type: "CREACION",
            quantity: v.stock,
            stockAfter: v.stock,
            note: v.color ? "Color o talla nueva" : "Talla nueva",
          });
        }
      }
    });
  }

  // Sin las tallas cargadas, save() no reescribe el stock con valores viejos
  delete (product as Partial<Product>).sizes;
  await productRepo().save(product);
  product.sizes = await AppDataSource.getRepository(ProductSize).find({
    where: { productId: product.id },
    loadEagerRelations: false,
  });
  res.json(withImageUrls(req, product));
});

router.delete("/:id", authMiddleware, async (req: Request, res: Response) => {
  const product = await productRepo().findOne({
    where: { id: parseInt(req.params.id as string) },
  });
  if (!product)
    return res.status(404).json({ message: "Producto no encontrado" });

  await productRepo().remove(product);
  res.json({ message: "Producto eliminado" });
});

export default router;
