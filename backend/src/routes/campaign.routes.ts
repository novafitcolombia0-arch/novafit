import { Request, Response } from "express";
import { createRouter } from "../middleware/errors";
import { AppDataSource } from "../config/data-source";
import { EmailCampaign, Subscriber, User } from "../entities";
import { authMiddleware, AuthRequest } from "../middleware/auth";
import { emailConfig, enqueueEmail, promotionEmail, sendEmail } from "../services/email";
import { ensureUnsubscribeToken, manualUnsubscribeUrl, unsubscribeUrl } from "./subscriber.routes";
import { In } from "typeorm";

// Tope por envío manual (el plan gratis de Resend permite 100 correos al día)
const MAX_MANUAL = 100;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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
  const mail = promotionEmail({ ...parsed.data!, email: to, subject: `[PRUEBA] ${parsed.data!.subject}`, unsubscribeUrl: unsubscribeUrl(req, "prueba") });
  const result = await sendEmail({ to, ...mail, category: "prueba" });
  if (!result.ok) return res.status(result.skipped ? 503 : 502).json({ message: result.skipped ? "El correo no está configurado todavía" : result.error });
  res.json({ message: `Prueba enviada a ${to}` });
});

/**
 * Enviar la promoción (en segundo plano, por la cola de correos con reintentos):
 *  - sin "emails": a todos los suscriptores activos
 *  - con "emails": a esa lista escrita a mano (se omiten quienes se dieron de baja)
 */
router.post("/", async (req: Request, res: Response) => {
  if (!emailConfig().configured) return res.status(503).json({ message: "El correo no está configurado todavía" });
  const parsed = readCampaign(req.body);
  if (parsed.error) return res.status(400).json({ message: parsed.error });
  if (await repo().findOne({ where: { status: "SENDING" } })) {
    return res.status(409).json({ message: "Ya hay una promoción enviándose. Espera a que termine." });
  }

  const subRepo = AppDataSource.getRepository(Subscriber);
  const manual = Array.isArray(req.body?.emails);
  let recipients: { email: string; name?: string; unsubscribe: (base: any) => Promise<string> }[];

  if (manual) {
    const list = [...new Set((req.body.emails as unknown[]).map((e) => String(e ?? "").trim().toLowerCase()).filter(Boolean))];
    const invalid = list.filter((e) => !EMAIL_RE.test(e));
    if (invalid.length) return res.status(400).json({ message: `Correos no válidos: ${invalid.slice(0, 5).join(", ")}` });
    if (!list.length) return res.status(400).json({ message: "Escribe al menos un correo" });
    if (list.length > MAX_MANUAL) return res.status(400).json({ message: `Máximo ${MAX_MANUAL} correos por envío` });
    const optedOut = new Set((await subRepo.find({ where: { email: In(list), unsubscribed: true }, select: ["email"] })).map((s) => s.email));
    recipients = list.filter((e) => !optedOut.has(e)).map((email) => ({ email, unsubscribe: async (base) => manualUnsubscribeUrl(base, email) }));
    if (!recipients.length) return res.status(400).json({ message: "Todas esas personas se dieron de baja de los correos" });
  } else {
    const subscribers = await subRepo.find({ where: { unsubscribed: false } });
    if (!subscribers.length) return res.status(400).json({ message: "No hay suscriptores activos" });
    recipients = subscribers.map((s) => ({ email: s.email, name: s.name, unsubscribe: async (base) => unsubscribeUrl(base, await ensureUnsubscribeToken(s)) }));
  }

  const campaign = await repo().save(repo().create({ ...parsed.data!, audience: manual ? "MANUAL" : "SUBSCRIBERS", status: "SENDING", recipients: recipients.length }));
  res.status(202).json(campaign);

  const base = { protocol: req.protocol, host: req.get("host") };
  (async () => {
    let sent = 0;
    let failed = 0;
    await Promise.all(recipients.map(async (r) => {
      const url = await r.unsubscribe(base);
      const mail = promotionEmail({ ...parsed.data!, name: r.name, email: r.email, unsubscribeUrl: url });
      const result = await enqueueEmail({ to: r.email, toName: r.name, ...mail, category: "promocion", unsubscribeUrl: url });
      if (result.ok) sent++; else failed++;
      if ((sent + failed) % 10 === 0) await repo().update(campaign.id, { sent, failed });
    }));
    await repo().update(campaign.id, { sent, failed, status: "SENT", finishedAt: new Date() });
  })().catch(async (err) => {
    console.error("[promoción] error:", err?.message);
    await repo().update(campaign.id, { status: "SENT", finishedAt: new Date() }).catch(() => {});
  });
});

export default router;
