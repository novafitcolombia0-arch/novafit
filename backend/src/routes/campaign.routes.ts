import { Request, Response } from "express";
import { createRouter } from "../middleware/errors";
import { AppDataSource } from "../config/data-source";
import { EmailCampaign, Subscriber, User } from "../entities";
import { authMiddleware, AuthRequest } from "../middleware/auth";
import { emailConfig, promotionEmail, sendEmail } from "../services/email";
import { ensureUnsubscribeToken, unsubscribeUrl } from "./subscriber.routes";

const router = createRouter();
const repo = () => AppDataSource.getRepository(EmailCampaign);
router.use(authMiddleware);

const clean = (v: unknown, max: number) => String(v ?? "").trim().slice(0, max);

function readCampaign(body: any) {
  const data = {
    subject: clean(body?.subject, 150),
    title: clean(body?.title, 150),
    message: clean(body?.message, 5000),
    discountCode: clean(body?.discountCode, 40).toUpperCase() || undefined,
    buttonText: clean(body?.buttonText, 40) || undefined,
    buttonUrl: clean(body?.buttonUrl, 300) || undefined,
  };
  if (!data.subject || !data.title || !data.message) return { error: "Escribe el asunto, el título y el mensaje" };
  if (data.buttonUrl && !/^https:\/\//.test(data.buttonUrl)) return { error: "El enlace del botón debe empezar por https://" };
  return { data };
}

/** Historial de promociones y si el correo está configurado */
router.get("/", async (_req: Request, res: Response) => {
  const cfg = emailConfig();
  const active = await AppDataSource.getRepository(Subscriber).count({ where: { unsubscribed: false } });
  res.json({
    configured: cfg.configured,
    provider: cfg.provider,
    from: cfg.from || null,
    activeSubscribers: active,
    campaigns: await repo().find({ order: { createdAt: "DESC" }, take: 50 }),
  });
});

/** Enviar una prueba al correo del admin (o a otro) antes de mandarla a todos */
router.post("/test", async (req: AuthRequest, res: Response) => {
  const parsed = readCampaign(req.body);
  if (parsed.error) return res.status(400).json({ message: parsed.error });
  const admin = await AppDataSource.getRepository(User).findOne({ where: { id: req.userId! } });
  const to = clean(req.body?.to, 120).toLowerCase() || admin?.email || "";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) return res.status(400).json({ message: "Correo de prueba no válido" });
  const mail = promotionEmail({ ...parsed.data!, subject: `[PRUEBA] ${parsed.data!.subject}`, unsubscribeUrl: unsubscribeUrl(req, "prueba") });
  const result = await sendEmail({ to, ...mail, category: "prueba" });
  if (!result.ok) return res.status(result.skipped ? 503 : 502).json({ message: result.skipped ? "El correo no está configurado todavía" : result.error });
  res.json({ message: `Prueba enviada a ${to}` });
});

/** Enviar la promoción a todos los suscriptores activos (en segundo plano) */
router.post("/", async (req: Request, res: Response) => {
  if (!emailConfig().configured) return res.status(503).json({ message: "El correo no está configurado todavía" });
  const parsed = readCampaign(req.body);
  if (parsed.error) return res.status(400).json({ message: parsed.error });
  if (await repo().findOne({ where: { status: "SENDING" } })) {
    return res.status(409).json({ message: "Ya hay una promoción enviándose. Espera a que termine." });
  }

  const subscribers = await AppDataSource.getRepository(Subscriber).find({ where: { unsubscribed: false } });
  if (!subscribers.length) return res.status(400).json({ message: "No hay suscriptores activos" });

  const campaign = await repo().save(repo().create({ ...parsed.data!, status: "SENDING", recipients: subscribers.length }));
  res.status(202).json(campaign);

  // Envío en segundo plano, de a 5 a la vez, para no saturar el proveedor
  const base = { protocol: req.protocol, host: req.get("host") };
  (async () => {
    let sent = 0;
    let failed = 0;
    const queue = [...subscribers];
    const worker = async () => {
      for (let s = queue.shift(); s; s = queue.shift()) {
        const token = await ensureUnsubscribeToken(s);
        const mail = promotionEmail({ ...parsed.data!, name: s.name, unsubscribeUrl: unsubscribeUrl(base, token) });
        const result = await sendEmail({ to: s.email, toName: s.name, ...mail, category: "promocion", unsubscribeUrl: unsubscribeUrl(base, token) });
        if (result.ok) sent++; else failed++;
        if ((sent + failed) % 20 === 0) await repo().update(campaign.id, { sent, failed });
      }
    };
    await Promise.all(Array.from({ length: 5 }, worker));
    await repo().update(campaign.id, { sent, failed, status: "SENT", finishedAt: new Date() });
  })().catch(async (err) => {
    console.error("[promoción] error:", err?.message);
    await repo().update(campaign.id, { status: "SENT", finishedAt: new Date() }).catch(() => {});
  });
});

export default router;
