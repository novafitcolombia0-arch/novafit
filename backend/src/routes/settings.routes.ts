import { Router, Request, Response } from "express";
import { AppDataSource } from "../config/data-source";
import { SiteSetting } from "../entities";
import { authMiddleware } from "../middleware/auth";

const router = Router();
const settingRepo = () => AppDataSource.getRepository(SiteSetting);

router.get("/", async (_req: Request, res: Response) => {
  const settings = await settingRepo().find();
  const result: Record<string, string> = {};
  settings.forEach((s) => (result[s.key] = s.value));
  res.json(result);
});

router.get("/:key", async (req: Request, res: Response) => {
  const setting = await settingRepo().findOne({
    where: { key: req.params.key as string },
  });
  if (!setting) return res.status(404).json({ message: "Setting no encontrada" });
  res.json({ key: setting.key, value: setting.value });
});

router.put("/", authMiddleware, async (req: Request, res: Response) => {
  const { settings } = req.body;
  for (const [key, value] of Object.entries(settings)) {
    await settingRepo().upsert({ key, value: value as string }, ["key"]);
  }
  res.json({ message: "Settings actualizadas" });
});

export default router;
