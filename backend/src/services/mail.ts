import { Resend } from "resend";

/**
 * Servicio de correo de la tienda.
 *
 * Todo el código envía a través de la interfaz MailProvider, así que cambiar de proveedor es
 * cambiar variables de entorno: MAIL_PROVIDER (o se elige solo según la llave que haya).
 *   - resend:   RESEND_API_KEY (empieza por "re_")
 *   - brevo:    BREVO_API_KEY (empieza por "xkeysib-")
 *   - twilio:   TWILIO_API_KEY + TWILIO_API_SECRET (Twilio Email API)
 *   - sendgrid: SENDGRID_API_KEY (empieza por "SG.")
 * Remitente: EMAIL_FROM, ya sea "Novafit <notificaciones@mail.novafitmb.com>" o solo el correo
 * (con EMAIL_FROM_NAME). Mientras el dominio no esté verificado en Resend: onboarding@resend.dev.
 * Sin llave no se envía nada: se anota en el log (útil en local).
 */

export interface EmailMessage {
  to: string;
  toName?: string;
  subject: string;
  html: string;
  text: string;
  category: "bienvenida" | "pago" | "envio" | "promocion" | "prueba";
  unsubscribeUrl?: string;
}

/** retryable: el fallo es temporal (límite de envío, error del proveedor, red) y vale la pena reintentar */
export type SendResult = { ok: true; id?: string } | { ok: false; skipped?: boolean; retryable?: boolean; error: string };

interface Sender { address: string; name: string }

export interface MailProvider {
  readonly name: string;
  send(msg: EmailMessage, from: Sender, replyTo: string): Promise<SendResult>;
}

const retryableStatus = (status: number | null | undefined) => !status || status === 429 || status >= 500;

const unsubscribeHeaders = (msg: EmailMessage) =>
  msg.unsubscribeUrl
    ? { "List-Unsubscribe": `<${msg.unsubscribeUrl}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" }
    : undefined;

/** Proveedores que responden por HTTP: un fallo de red también se reintenta */
async function httpSend(name: string, url: string, init: RequestInit, okStatus: number[]): Promise<SendResult> {
  try {
    const res = await fetch(url, init);
    if (okStatus.includes(res.status)) return { ok: true };
    const detail = (await res.text()).slice(0, 300);
    return { ok: false, retryable: retryableStatus(res.status), error: `${name} respondió ${res.status}: ${detail}` };
  } catch (err: any) {
    return { ok: false, retryable: true, error: `${name}: ${err?.message || "error de red"}` };
  }
}

class ResendProvider implements MailProvider {
  readonly name = "Resend";
  private client: Resend;
  constructor(apiKey: string) { this.client = new Resend(apiKey); }

  async send(msg: EmailMessage, from: Sender, replyTo: string): Promise<SendResult> {
    try {
      const { data, error } = await this.client.emails.send({
        from: `${from.name} <${from.address}>`,
        to: [msg.to],
        subject: msg.subject,
        html: msg.html,
        text: msg.text,
        ...(replyTo ? { replyTo } : {}),
        ...(unsubscribeHeaders(msg) ? { headers: unsubscribeHeaders(msg) } : {}),
        tags: [{ name: "category", value: msg.category }],
      });
      if (error) return { ok: false, retryable: retryableStatus(error.statusCode), error: `Resend (${error.name}): ${error.message}` };
      return { ok: true, id: data?.id };
    } catch (err: any) {
      return { ok: false, retryable: true, error: `Resend: ${err?.message || "error de red"}` };
    }
  }
}

class BrevoProvider implements MailProvider {
  readonly name = "Brevo";
  constructor(private apiKey: string) {}
  send(msg: EmailMessage, from: Sender, replyTo: string) {
    return httpSend(this.name, "https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: { "api-key": this.apiKey, "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        sender: { email: from.address, name: from.name },
        to: [{ email: msg.to, ...(msg.toName ? { name: msg.toName } : {}) }],
        ...(replyTo ? { replyTo: { email: replyTo } } : {}),
        subject: msg.subject,
        htmlContent: msg.html,
        textContent: msg.text,
        tags: [msg.category],
        ...(unsubscribeHeaders(msg) ? { headers: unsubscribeHeaders(msg) } : {}),
      }),
    }, [201]);
  }
}

class TwilioEmailProvider implements MailProvider {
  readonly name = "Twilio";
  constructor(private key: string, private secret: string) {}
  send(msg: EmailMessage, from: Sender) {
    return httpSend(this.name, "https://comms.twilio.com/v1/Emails", {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${this.key}:${this.secret}`).toString("base64")}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: { address: from.address, name: from.name },
        to: [{ address: msg.to, ...(msg.toName ? { name: msg.toName } : {}) }],
        content: { subject: msg.subject, html: msg.html, text: msg.text, ...(unsubscribeHeaders(msg) ? { headers: unsubscribeHeaders(msg) } : {}) },
        tags: { category: msg.category },
      }),
    }, [202]);
  }
}

class SendGridProvider implements MailProvider {
  readonly name = "SendGrid";
  constructor(private apiKey: string) {}
  send(msg: EmailMessage, from: Sender, replyTo: string) {
    return httpSend(this.name, "https://api.sendgrid.com/v3/mail/send", {
      method: "POST",
      headers: { Authorization: `Bearer ${this.apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: msg.to, ...(msg.toName ? { name: msg.toName } : {}) }] }],
        from: { email: from.address, name: from.name },
        ...(replyTo ? { reply_to: { email: replyTo } } : {}),
        subject: msg.subject,
        content: [{ type: "text/plain", value: msg.text }, { type: "text/html", value: msg.html }],
        categories: [msg.category],
        ...(unsubscribeHeaders(msg) ? { headers: unsubscribeHeaders(msg) } : {}),
      }),
    }, [202]);
  }
}

/** "Novafit <a@b.com>" o "a@b.com" (+ EMAIL_FROM_NAME) */
function parseFrom(): Sender {
  const raw = (process.env.EMAIL_FROM || "").trim();
  const match = raw.match(/^\s*"?([^"<]*?)"?\s*<([^>]+)>\s*$/);
  if (match) return { name: match[1].trim() || process.env.EMAIL_FROM_NAME || "Nova FIT", address: match[2].trim() };
  return { name: process.env.EMAIL_FROM_NAME || "Nova FIT", address: raw };
}

let cached: { key: string; provider: MailProvider | null } | null = null;

/** Proveedor según MAIL_PROVIDER o, si no se indica, según la llave que haya */
function provider(): MailProvider | null {
  const e = process.env;
  const key = [e.MAIL_PROVIDER, e.RESEND_API_KEY, e.BREVO_API_KEY, e.TWILIO_API_KEY, e.SENDGRID_API_KEY].join("|");
  if (cached?.key === key) return cached.provider;
  const wanted = (e.MAIL_PROVIDER || "").toLowerCase();
  const pick =
    wanted ||
    (e.RESEND_API_KEY ? "resend" : e.BREVO_API_KEY ? "brevo" : e.TWILIO_API_KEY && e.TWILIO_API_SECRET ? "twilio" : e.SENDGRID_API_KEY ? "sendgrid" : "");
  const p =
    pick === "resend" && e.RESEND_API_KEY ? new ResendProvider(e.RESEND_API_KEY)
    : pick === "brevo" && e.BREVO_API_KEY ? new BrevoProvider(e.BREVO_API_KEY)
    : pick === "twilio" && e.TWILIO_API_KEY && e.TWILIO_API_SECRET ? new TwilioEmailProvider(e.TWILIO_API_KEY, e.TWILIO_API_SECRET)
    : pick === "sendgrid" && e.SENDGRID_API_KEY ? new SendGridProvider(e.SENDGRID_API_KEY)
    : null;
  cached = { key, provider: p };
  return p;
}

export function emailConfig() {
  const from = parseFrom();
  const p = provider();
  return {
    provider: p?.name ?? null,
    from: from.address,
    fromName: from.name,
    replyTo: process.env.EMAIL_REPLY_TO || "",
    frontendUrl: (process.env.FRONTEND_URL || "https://novafitmb.com").replace(/\/$/, ""),
    configured: !!p && !!from.address,
  };
}

/** Envío inmediato (una sola vez). Para los correos de la tienda se usa la cola: enqueueEmail. Nunca lanza errores. */
export async function sendEmail(msg: EmailMessage): Promise<SendResult> {
  const cfg = emailConfig();
  const p = provider();
  if (!cfg.configured || !p) {
    console.log(`[correo omitido: falta la llave del proveedor o EMAIL_FROM] ${msg.category} → ${msg.to}: ${msg.subject}`);
    return { ok: false, skipped: true, error: "El correo no está configurado todavía" };
  }
  const result = await p.send(msg, { address: cfg.from, name: cfg.fromName }, cfg.replyTo);
  if (!result.ok) console.error(`[correo] ${msg.category} → ${msg.to}: ${result.error}`);
  return result;
}

// ---------- Cola con reintentos ----------
// Los correos salen fuera de la petición (la clienta no espera) y, si el proveedor falla de forma
// temporal (límite, caída, red), se reintentan: 30 s, 2 min, 10 min, 30 min.
// La cola vive en memoria: un reinicio del servidor pierde lo pendiente. Si hiciera falta
// persistirla, esta misma función se puede pasar a BullMQ + Redis sin tocar a quien la llama.

const RETRY_DELAYS_MS = [30_000, 120_000, 600_000, 1_800_000];
// Resend admite ~2 peticiones por segundo: se envía de a una cada 600 ms
const MIN_GAP_MS = 600;

interface Job { msg: EmailMessage; attempt: number; resolve: (r: SendResult) => void }
const queue: Job[] = [];
let working = false;

async function work() {
  if (working) return;
  working = true;
  try {
    for (let job = queue.shift(); job; job = queue.shift()) {
      const result = await sendEmail(job.msg);
      if (!result.ok && !("skipped" in result && result.skipped) && result.retryable && job.attempt < RETRY_DELAYS_MS.length) {
        const delay = RETRY_DELAYS_MS[job.attempt];
        console.warn(`[correo] reintento ${job.attempt + 1} en ${delay / 1000}s → ${job.msg.to}`);
        const retry = { ...job, attempt: job.attempt + 1 };
        setTimeout(() => { queue.push(retry); void work(); }, delay).unref();
      } else {
        job.resolve(result);
      }
      await new Promise((r) => setTimeout(r, MIN_GAP_MS));
    }
  } finally {
    working = false;
  }
}

/** Encola un correo; la promesa se resuelve con el resultado final (tras los reintentos) */
export function enqueueEmail(msg: EmailMessage): Promise<SendResult> {
  return new Promise((resolve) => {
    queue.push({ msg, attempt: 0, resolve });
    void work();
  });
}

export const pendingEmails = () => queue.length;
