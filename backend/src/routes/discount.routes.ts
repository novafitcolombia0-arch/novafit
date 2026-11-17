import { Request, Response } from "express";
import { createRouter } from "../middleware/errors";
import { AppDataSource } from "../config/data-source";
import { DiscountCode } from "../entities";
import { authMiddleware } from "../middleware/auth";
import { evaluateDiscount, generateCode, normalizeCode } from "../services/discounts";

const router = createRouter();
const repo = () => AppDataSource.getRepository(DiscountCode);

/** Pública: valida un código en el checkout y devuelve el porcentaje */
router.post("/validate", async (req: Request, res: Response) => {
  const email = String(req.body?.email ?? "").trim().toLowerCase().slice(0, 120);
  const subtotal = Math.max(0, Math.round(Number(req.body?.subtotal) || 0));
  const result = await evaluateDiscount(req.body?.code, email, subtotal);
  if (!result.ok) return res.status(400).json({ message: result.message });
  res.json({ code: result.discount.code, percent: result.discount.percent, amount: result.amount });
});

/** Pública: porcentaje que ofrece el modal de suscripción (sin revelar el código) */
router.get("/welcome-offer", async (_req: Request, res: Response) => {
  const welcome = await repo().findOne({ where: { isWelcome: true, active: true } });
  const valid = welcome && (!welcome.expiresAt || welcome.expiresAt.getTime() > Date.now()) &&
    (welcome.maxUses === null || welcome.usedCount < welcome.maxUses);
  res.json(valid ? { enabled: true, percent: welcome.percent, firstPurchaseOnly: welcome.firstPurchaseOnly } : { enabled: false });
});

// ---------- Panel de administración ----------

router.get("/", authMiddleware, async (_req: Request, res: Response) => {
  res.json(await repo().find({ order: { createdAt: "DESC" } }));
});

function readBody(body: any) {
  const percent = Math.round(Number(body?.percent));
  const maxUses = body?.maxUses === null || body?.maxUses === "" || body?.maxUses === undefined ? null : Math.round(Number(body.maxUses));
  const expiresAt = body?.expiresAt ? new Date(body.expiresAt) : null;
  if (!(percent >= 1 && percent <= 100)) return { error: "El porcentaje debe estar entre 1 y 100" };
  if (maxUses !== null && !(maxUses >= 1)) return { error: "Los usos máximos deben ser 1 o más (o vacío para ilimitado)" };
  if (expiresAt && Number.isNaN(expiresAt.getTime())) return { error: "Fecha de vencimiento no válida" };
  return {
    data: {
      percent,
      maxUses,
      expiresAt,
      active: body?.active ?? true,
      firstPurchaseOnly: !!body?.firstPurchaseOnly,
      isWelcome: !!body?.isWelcome,
      description: String(body?.description ?? "").trim().slice(0, 200) || undefined,
    },
  };
}

/** Solo un código puede ser el de bienvenida */
async function clearOtherWelcome(exceptId: number) {
  await repo().createQueryBuilder().update().set({ isWelcome: false })
    .where("id <> :id AND \"isWelcome\" = true", { id: exceptId }).execute();
}

/** Crear: si no se envía código, se genera uno (p. ej. BIENVENIDA-7KQ2XM) */
router.post("/", authMiddleware, async (req: Request, res: Response) => {
  const parsed = readBody(req.body);
  if (parsed.error) return res.status(400).json({ message: parsed.error });
  let code = normalizeCode(req.body?.code);
  if (code && !/^[A-Z0-9_-]{3,40}$/.test(code)) {
    return res.status(400).json({ message: "El código solo puede tener letras, números, - y _ (mínimo 3)" });
  }
  if (!code) {
    do { code = generateCode(req.body?.prefix || "NOVA"); } while (await repo().findOne({ where: { code } }));
  } else if (await repo().findOne({ where: { code } })) {
    return res.status(409).json({ message: `Ya existe el código ${code}` });
  }
  const saved = await repo().save(repo().create({ ...parsed.data, code }));
  if (saved.isWelcome) await clearOtherWelcome(saved.id);
  res.status(201).json(saved);
});

router.put("/:id", authMiddleware, async (req: Request, res: Response) => {
  const discount = await repo().findOne({ where: { id: parseInt(req.params.id as string, 10) } });
  if (!discount) return res.status(404).json({ message: "Código no encontrado" });
  const parsed = readBody({ ...discount, ...req.body });
  if (parsed.error) return res.status(400).json({ message: parsed.error });
  Object.assign(discount, parsed.data); // el texto del código no se cambia: los pedidos lo referencian
  const saved = await repo().save(discount);
  if (saved.isWelcome) await clearOtherWelcome(saved.id);
  res.json(saved);
});

/** Borrar solo si nunca se usó; si ya se usó, se desactiva para conservar el historial */
router.delete("/:id", authMiddleware, async (req: Request, res: Response) => {
  const discount = await repo().findOne({ where: { id: parseInt(req.params.id as string, 10) } });
  if (!discount) return res.status(404).json({ message: "Código no encontrado" });
  if (discount.usedCount > 0) {
    await repo().update(discount.id, { active: false, isWelcome: false });
    return res.json({ message: "El código ya se usó: se desactivó en lugar de borrarse", deactivated: true });
  }
  await repo().delete(discount.id);
  res.json({ message: "Código eliminado" });
});

export default router;
