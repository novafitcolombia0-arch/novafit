import { Request, Response } from "express";
import { createRouter, slugify } from "../middleware/errors";
import { AppDataSource } from "../config/data-source";
import { Category } from "../entities";
import { authMiddleware } from "../middleware/auth";

const router = createRouter();
const categoryRepo = () => AppDataSource.getRepository(Category);

router.get("/", async (_req: Request, res: Response) => {
  const categories = await categoryRepo().find({ order: { id: "ASC" } });
  res.json(categories);
});

router.get("/:id", async (req: Request, res: Response) => {
  const category = await categoryRepo().findOne({
    where: { id: parseInt(req.params.id as string) },
  });
  if (!category)
    return res.status(404).json({ message: "Categoría no encontrada" });
  res.json(category);
});

router.post("/", authMiddleware, async (req: Request, res: Response) => {
  const { name, description, image, isActive } = req.body;
  const slug = slugify(req.body.slug || name || "");
  if (!name || !slug)
    return res.status(400).json({ message: "Nombre y slug requeridos" });

  const exists = await categoryRepo().findOne({ where: { slug } });
  if (exists)
    return res.status(400).json({ message: "Ya existe una categoría con ese slug" });

  const category = categoryRepo().create({
    name,
    slug,
    description,
    image,
    isActive: isActive ?? true,
  });
  await categoryRepo().save(category);
  res.status(201).json(category);
});

router.put("/:id", authMiddleware, async (req: Request, res: Response) => {
  const category = await categoryRepo().findOne({
    where: { id: parseInt(req.params.id as string) },
  });
  if (!category)
    return res.status(404).json({ message: "Categoría no encontrada" });

  const { id: _id, products: _products, ...changes } = req.body;
  if (changes.slug !== undefined) changes.slug = slugify(changes.slug);
  Object.assign(category, changes);
  await categoryRepo().save(category);
  res.json(category);
});

router.delete("/:id", authMiddleware, async (req: Request, res: Response) => {
  const category = await categoryRepo().findOne({
    where: { id: parseInt(req.params.id as string) },
  });
  if (!category)
    return res.status(404).json({ message: "Categoría no encontrada" });

  await categoryRepo().remove(category);
  res.json({ message: "Categoría eliminada" });
});

export default router;
