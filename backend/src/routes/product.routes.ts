import { Request, Response } from "express";
import { createRouter } from "../middleware/errors";
import { AppDataSource } from "../config/data-source";
import { Product, ProductImage } from "../entities";
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
  const products = await productRepo().find({
    relations: ["category", "images", "sizes"],
    order: { id: "DESC" },
  });
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
  const { name, slug, description, price, categoryId, images, sizes, isActive } =
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
    categoryId,
    isActive: isActive ?? true,
    images: (images || []).filter((img: any) => isDataUrl(img.imageData)),
    sizes: sizes || [],
  });
  await productRepo().save(product);
  res.status(201).json(withImageUrls(req, product));
});

router.put("/:id", authMiddleware, async (req: Request, res: Response) => {
  const product = await productRepo().findOne({
    where: { id: parseInt(req.params.id as string) },
    relations: ["images", "sizes"],
  });
  if (!product)
    return res.status(404).json({ message: "Producto no encontrado" });

  const { images, sizes, ...rest } = req.body;
  Object.assign(product, rest);

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

  if (sizes) {
    await AppDataSource.getRepository("ProductSize").delete({ productId: product.id });
    product.sizes = sizes.map((sz: any) =>
      AppDataSource.getRepository("ProductSize").create({
        ...sz,
        productId: product.id,
      })
    );
  }

  await productRepo().save(product);
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
