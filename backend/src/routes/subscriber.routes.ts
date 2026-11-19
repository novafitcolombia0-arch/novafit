import { Request, Response } from "express";
import crypto from "crypto";
import { createRouter } from "../middleware/errors";
import { AppDataSource } from "../config/data-source";
import { DiscountCode, Subscriber } from "../entities";
import { authMiddleware } from "../middleware/auth";
import { subscribeLimiter } from "../config/security";
import { enqueueEmail, welcomeEmail } from "../services/email";
import { jwtSecret } from "../config/security";

const router = createRouter();
const repo = () => AppDataSource.getRepository(Subscriber);

/** Token secreto del enlace de baja (se crea la primera vez que se necesita) */
export async function ensureUnsubscribeToken(s: Subscriber) {
  if (s.unsubscribeToken) return s.unsubscribeToken;
  const token = crypto.randomBytes(24).toString("base64url");
  await repo().update(s.id, { unsubscribeToken: token });
  s.unsubscribeToken = token;
  return token;
}

type BaseUrl = { protocol: string; get?: (h: string) => string | undefined; host?: string };
const apiBase = (req: BaseUrl) => `${req.protocol}://${typeof req.get === "function" ? req.get("host") : req.host}/api/subscribers/unsubscribe`;

/** Enlace "darme de baja" de un suscriptor (lo sirve este mismo backend) */
export function unsubscribeUrl(req: BaseUrl, token: string) {
  return `${apiBase(req)}?token=${encodeURIComponent(token)}`;
}

/** Firma del enlace de baja para correos escritos a mano (personas que no están en la lista) */
const emailSignature = (email: string) => crypto.createHmac("sha256", jwtSecret()).update(`baja:${email}`).digest("base64url");

export function manualUnsubscribeUrl(req: BaseUrl, email: string) {
  return `${apiBase(req)}?e=${encodeURIComponent(email)}&sig=${emailSignature(email)}`;
}

/** Pública: suscribirse desde el modal y recibir el código de bienvenida */
router.post("/", subscribeLimiter, async (req: Request, res: Response) => {
  const email = String(req.body?.email ?? "").trim().toLowerCase().slice(0, 120);
  const name = String(req.body?.name ?? "").trim().slice(0, 80) || undefined;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ message: "Escribe un correo válido" });

  const welcome = await AppDataSource.getRepository(DiscountCode).findOne({ where: { isWelcome: true, active: true } });
  const usable = welcome && (!welcome.expiresAt || welcome.expiresAt.getTime() > Date.now()) &&
    (welcome.maxUses === null || welcome.usedCount < welcome.maxUses);

  let subscriber = await repo().findOne({ where: { email } });
  const isNew = !subscriber || subscriber.unsubscribed;
  if (subscriber) {
    // Volver a suscribirse después de una baja la reactiva
    await repo().update(subscriber.id, {
      ...(name && !subscriber.name ? { name } : {}),
      ...(subscriber.unsubscribed ? { unsubscribed: false, unsubscribedAt: null } : {}),
    });
  } else {
    subscriber = await repo().save(repo().create({ email, name, discountCode: usable ? welcome!.code : undefined }));
  }

  // Correo de bienvenida solo la primera vez (o al volver tras una baja), sin hacer esperar a la clienta
  if (isNew) {
    const token = await ensureUnsubscribeToken(subscriber);
    const url = unsubscribeUrl(req, token);
    const mail = welcomeEmail({
      name: name || subscriber.name,
      code: usable ? welcome!.code : undefined,
      percent: welcome?.percent,
      firstPurchaseOnly: welcome?.firstPurchaseOnly,
      unsubscribeUrl: url,
    });
    void enqueueEmail({ to: email, toName: name, ...mail, category: "bienvenida", unsubscribeUrl: url });
  }

  res.status(isNew ? 201 : 200).json(
    usable ? { subscribed: true, code: welcome!.code, percent: welcome!.percent, firstPurchaseOnly: welcome!.firstPurchaseOnly } : { subscribed: true }
  );
});

const page = (title: string, text: string) => `<!doctype html><html lang="es"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title></head>
<body style="margin:0;font-family:Helvetica,Arial,sans-serif;background:#f6f3ef;color:#1e1e1e">
<div style="max-width:480px;margin:80px auto;background:#fff;border-radius:8px;padding:40px;text-align:center">
<img src="https://novafitmb.com/assets/logo-black.png" alt="Nova FIT" style="height:44px"><h1 style="font-size:22px">${title}</h1>
<p style="color:#696969;line-height:1.6">${text}</p>
<a href="https://novafitmb.com" style="display:inline-block;margin-top:12px;background:#1e1e1e;color:#fff;text-decoration:none;padding:12px 28px;border-radius:4px">Ir a la tienda</a>
</div></body></html>`;

async function unsubscribe(query: Record<string, unknown>) {
  const token = String(query.token ?? "");
  // Enlace firmado de un correo escrito a mano: se registra la baja aunque no estuviera en la lista
  const email = String(query.e ?? "").trim().toLowerCase();
  const sig = String(query.sig ?? "");
  if (email && sig) {
    const expected = Buffer.from(emailSignature(email));
    const given = Buffer.from(sig);
    if (expected.length !== given.length || !crypto.timingSafeEqual(expected, given)) return false;
    const s = await repo().findOne({ where: { email } });
    if (s) { if (!s.unsubscribed) await repo().update(s.id, { unsubscribed: true, unsubscribedAt: new Date() }); }
    else await repo().save(repo().create({ email, unsubscribed: true, unsubscribedAt: new Date() }));
    return true;
  }
  if (!token || token === "prueba") return false;
  const s = await repo().findOne({ where: { unsubscribeToken: token } });
  if (!s) return false;
  if (!s.unsubscribed) await repo().update(s.id, { unsubscribed: true, unsubscribedAt: new Date() });
  return true;
}

/** Pública: enlace "darme de baja" de los correos */
router.get("/unsubscribe", async (req: Request, res: Response) => {
  const ok = await unsubscribe(req.query);
  res.status(ok ? 200 : 404).type("html").send(
    ok
      ? page("Listo, te diste de baja", "No te enviaremos más correos de promociones. Si fue un error, puedes volver a suscribirte desde la tienda.")
      : page("Enlace no válido", "Este enlace de baja no es válido o ya caducó.")
  );
});

/** Baja con un clic desde Gmail/Outlook (cabecera List-Unsubscribe-Post) */
router.post("/unsubscribe", async (req: Request, res: Response) => {
  const ok = await unsubscribe(req.query);
  res.status(ok ? 200 : 404).json({ unsubscribed: ok });
});

router.get("/", authMiddleware, async (_req: Request, res: Response) => {
  res.json(await repo().find({ order: { createdAt: "DESC" }, select: ["id", "email", "name", "discountCode", "unsubscribed", "unsubscribedAt", "createdAt"] }));
});

router.delete("/:id", authMiddleware, async (req: Request, res: Response) => {
  await repo().delete(parseInt(req.params.id as string, 10));
  res.json({ message: "Suscriptor eliminado" });
});

export default router;
