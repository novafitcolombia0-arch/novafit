import { Router, Request, Response } from "express";
import { AppDataSource } from "../config/data-source";
import { Category } from "../entities";
import { authMiddleware } from "../middleware/auth";

const router = Router();
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
  const { name, slug, description, image, isActive } = req.body;
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

  Object.assign(category, req.body);
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
