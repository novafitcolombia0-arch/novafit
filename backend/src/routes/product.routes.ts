import { Request, Response } from "express";
import { createRouter } from "../middleware/errors";
import { AppDataSource } from "../config/data-source";
import { Product, ProductImage, ProductSize } from "../entities";
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

router.post("/", authMiddleware, async (req: Request, res: Response) => {
  const { name, slug, description, price, cost, categoryId, images, sizes, isActive } =
    req.body;
  if (!name || !slug || !price || !categoryId) {
    return res
      .status(400)
      .json({ message: "Nombre, slug, precio y categoría requeridos" });
  }

  const exists = await productRepo().findOne({ where: { slug } });
  if (exists)
    return res.status(400).json({ message: "Ya existe un producto con ese slug" });

  const product = productRepo().create({
    name,
    slug,
    description,
    price,
    cost: cost === undefined || cost === null || cost === "" ? null : Math.max(0, Math.round(Number(cost))),
    categoryId,
    isActive: isActive ?? true,
    images: (images || []).filter((img: any) => isDataUrl(img.imageData)),
    sizes: sizes || [],
  });
  await productRepo().save(product);

  // Stock inicial al historial de inventario
  for (const sz of product.sizes || []) {
    if (sz.stock > 0) {
      await logMovement(AppDataSource.manager, {
        productId: product.id,
        productName: product.name,
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

  const { images, sizes, cost, ...rest } = req.body;
  Object.assign(product, rest);
  if (cost !== undefined) {
    product.cost = cost === null || cost === "" ? null : Math.max(0, Math.round(Number(cost)));
  }

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
        if (isDataUrl(img.imageData)) return { imageData: img.imageData, mimeType: img.mimeType, isMain: !!img.isMain };
        const old = stored.find((s) => s.id === img.id);
        return old && { imageData: old.imageData, mimeType: old.mimeType, isMain: !!img.isMain };
      })
      .filter(Boolean);
    await imageRepo.delete({ productId: product.id });
    product.images = kept.map((img: any) => imageRepo.create({ ...img, productId: product.id }));
  }

  if (Array.isArray(sizes)) {
    // Las tallas que ya existen conservan su stock real (se maneja desde Inventario y lo
    // descuentan las ventas web); aquí solo se agregan tallas nuevas o se quitan.
    await AppDataSource.transaction(async (manager) => {
      const current = await manager.find(ProductSize, {
        where: { productId: product.id },
        loadEagerRelations: false,
      });
      const incoming = new Map<string, number>();
      for (const sz of sizes) {
        const name = String(sz?.size || "").trim();
        if (name && !incoming.has(name)) incoming.set(name, Math.max(0, parseInt(sz?.stock, 10) || 0));
      }

      for (const row of current) {
        if (incoming.has(row.size)) continue;
        await manager.delete(ProductSize, row.id);
        if (row.stock > 0) {
          await logMovement(manager, {
            productId: product.id,
            productName: product.name,
            size: row.size,
            type: "ELIMINACION",
            quantity: -row.stock,
            stockAfter: 0,
            note: "Talla eliminada del producto",
          });
        }
      }

      for (const [size, stock] of incoming) {
        if (current.some((row) => row.size === size)) continue;
        await manager.insert(ProductSize, { productId: product.id, size, stock });
        if (stock > 0) {
          await logMovement(manager, {
            productId: product.id,
            productName: product.name,
            size,
            type: "CREACION",
            quantity: stock,
            stockAfter: stock,
            note: "Talla nueva",
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
