import { Request, Response } from "express";
import { createRouter } from "../middleware/errors";
import { AppDataSource } from "../config/data-source";
import { DiscountCode, Subscriber } from "../entities";
import { authMiddleware } from "../middleware/auth";

const router = createRouter();
const repo = () => AppDataSource.getRepository(Subscriber);

/** Pública: suscribirse desde el modal y recibir el código de bienvenida */
router.post("/", async (req: Request, res: Response) => {
  const email = String(req.body?.email ?? "").trim().toLowerCase().slice(0, 120);
  const name = String(req.body?.name ?? "").trim().slice(0, 80) || undefined;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ message: "Escribe un correo válido" });

  const welcome = await AppDataSource.getRepository(DiscountCode).findOne({ where: { isWelcome: true, active: true } });
  const usable = welcome && (!welcome.expiresAt || welcome.expiresAt.getTime() > Date.now()) &&
    (welcome.maxUses === null || welcome.usedCount < welcome.maxUses);

  const existing = await repo().findOne({ where: { email } });
  if (existing) {
    if (name && !existing.name) await repo().update(existing.id, { name });
  } else {
    await repo().save(repo().create({ email, name, discountCode: usable ? welcome!.code : undefined }));
  }
  res.status(existing ? 200 : 201).json(
    usable ? { subscribed: true, code: welcome!.code, percent: welcome!.percent, firstPurchaseOnly: welcome!.firstPurchaseOnly } : { subscribed: true }
  );
});

router.get("/", authMiddleware, async (_req: Request, res: Response) => {
  res.json(await repo().find({ order: { createdAt: "DESC" } }));
});

router.delete("/:id", authMiddleware, async (req: Request, res: Response) => {
  await repo().delete(parseInt(req.params.id as string, 10));
  res.json({ message: "Suscriptor eliminado" });
});

export default router;
