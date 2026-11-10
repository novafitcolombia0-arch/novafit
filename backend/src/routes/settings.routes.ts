import { Request, Response } from "express";
import { createRouter } from "../middleware/errors";
import { AppDataSource } from "../config/data-source";
import { SiteSetting } from "../entities";
import { authMiddleware } from "../middleware/auth";
import { heroImagesWithUrls, isDataUrl } from "./image.routes";

const router = createRouter();
const settingRepo = () => AppDataSource.getRepository(SiteSetting);

router.get("/", async (req: Request, res: Response) => {
  const settings = await settingRepo().find();
  const result: Record<string, string> = {};
  settings.forEach((s) => (result[s.key] = s.key === "heroImages" ? heroImagesWithUrls(req, s.value) : s.value));
  res.json(result);
});

router.get("/:key", async (req: Request, res: Response) => {
  const setting = await settingRepo().findOne({
    where: { key: req.params.key as string },
  });
  if (!setting) return res.status(404).json({ message: "Setting no encontrada" });
  const value = setting.key === "heroImages" ? heroImagesWithUrls(req, setting.value) : setting.value;
  res.json({ key: setting.key, value });
});

router.put("/", authMiddleware, async (req: Request, res: Response) => {
  const { settings } = req.body;
  if (typeof settings.heroImages === "string") {
    // Las imágenes que ya existían llegan como URL /hero/<índice>: se recuperan sus datos
    const current = await settingRepo().findOne({ where: { key: "heroImages" } });
    let stored: string[] = [];
    try { stored = JSON.parse(current?.value || "[]"); } catch {}
    const incoming: string[] = JSON.parse(settings.heroImages);
    const resolved = incoming
      .map((img) => {
        if (isDataUrl(img)) return img;
        const index = img.match(/\/images\/hero\/(\d+)/)?.[1];
        return index !== undefined ? stored[parseInt(index)] : undefined;
      })
      .filter((img): img is string => isDataUrl(img));
    settings.heroImages = JSON.stringify(resolved);
  }
  for (const [key, value] of Object.entries(settings)) {
    await settingRepo().upsert({ key, value: value as string }, ["key"]);
  }
  res.json({ message: "Settings actualizadas" });
});

export default router;
