import { Order } from "../entities";
import { emailConfig } from "./mail";

// Plantillas HTML de los correos de la tienda (el envío está en ./mail)
export { emailConfig, sendEmail, enqueueEmail } from "./mail";
export type { EmailMessage, SendResult } from "./mail";

// ---------- Utilidades ----------

const esc = (v: unknown) =>
  String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const money = (n: number) => `$${Math.round(n).toLocaleString("es-CO")} COP`;
const p = (html: string) => `<p style="margin:0 0 14px">${html}</p>`;
const paragraphs = (text: string) => esc(text).split(/\n{2,}/).map((t) => p(t.replace(/\n/g, "<br>"))).join("");

/** "Hola, Laura." — si no hay nombre se saluda con el correo */
const greetingName = (name: string | undefined, email: string | undefined) => (name || "").trim().split(/\s+/)[0] || email || "";

/** Fecha en hora de Colombia: "18 de noviembre de 2026" */
const fecha = (d: Date | string | null | undefined) =>
  new Date(d || Date.now()).toLocaleDateString("es-CO", { timeZone: "America/Bogota", day: "numeric", month: "long", year: "numeric" });

/** Bloque de datos tipo "Número de pedido: X" */
const dataRows = (rows: [string, string][]) =>
  `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:14px;margin:4px 0 18px">${rows
    .map(([k, v]) => `<tr><td style="padding:5px 12px 5px 0;color:#696969;white-space:nowrap;vertical-align:top">${esc(k)}:</td><td style="padding:5px 0;vertical-align:top">${v}</td></tr>`)
    .join("")}</table>`;

const sectionTitle = (t: string) =>
  `<p style="margin:22px 0 8px;font-size:13px;letter-spacing:2px;font-weight:bold;color:#1e1e1e">${esc(t)}</p>`;

const signature = (lines: string[]) =>
  `<p style="margin:24px 0 0">${lines.map((l, i) => (i === lines.length - 2 ? `<strong>${esc(l)}</strong>` : esc(l))).join("<br>")}</p>`;

const codeBox = (code: string) =>
  `<p style="text-align:center;margin:18px 0"><span style="display:inline-block;font-family:monospace;font-size:22px;letter-spacing:2px;border:2px dashed #b59677;border-radius:4px;padding:10px 20px">${esc(code)}</span></p>`;

// El logo se sirve desde la tienda publicada (la de QA pide login de Vercel y no cargaría en el correo)
const LOGO = "https://novafitmb.com/assets/logo-black.png";

function layout(opts: { preheader: string; title: string; body: string; button?: { text: string; url: string }; unsubscribeUrl?: string }) {
  const { frontendUrl } = emailConfig();
  const button = opts.button
    ? `<p style="margin:28px 0 8px;text-align:center"><a href="${esc(opts.button.url)}" style="display:inline-block;background:#1e1e1e;color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:4px;font-size:13px;letter-spacing:2px;text-transform:uppercase">${esc(opts.button.text)}</a></p>`
    : "";
  const unsubscribe = opts.unsubscribeUrl
    ? `<br><a href="${esc(opts.unsubscribeUrl)}" style="color:#696969">Darme de baja de los correos</a>`
    : "";
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(opts.title)}</title></head>
<body style="margin:0;padding:0;background:#f6f3ef;font-family:Manrope,Helvetica,Arial,sans-serif;color:#1e1e1e">
<span style="display:none;max-height:0;overflow:hidden">${esc(opts.preheader)}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f6f3ef;padding:24px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:8px;overflow:hidden">
<tr><td style="padding:28px 32px 8px;text-align:center"><a href="${esc(frontendUrl)}"><img src="${LOGO}" alt="Nova FIT" height="48" style="height:48px;width:auto;border:0"></a></td></tr>
<tr><td style="padding:8px 32px 32px;font-size:15px;line-height:1.6">
<h1 style="font-size:22px;line-height:1.3;margin:12px 0 18px;text-align:center">${esc(opts.title)}</h1>
${opts.body}${button}
</td></tr></table>
<p style="font-size:12px;color:#696969;margin:18px 0 0;line-height:1.6">NOVA FIT · Muestra tu mejor versión<br>
WhatsApp +57 318 701 6549 · novafitcolombia0@gmail.com${unsubscribe}</p>
</td></tr></table></body></html>`;
}

// ---------- 1. Bienvenida (al suscribirse) ----------

export function welcomeEmail(d: { name?: string; email?: string; code?: string; percent?: number; firstPurchaseOnly?: boolean; unsubscribeUrl: string }) {
  const { frontendUrl } = emailConfig();
  const who = greetingName(d.name, d.email);
  // Recordatorio del código que el modal ya mostró (por si cerró la ventana sin copiarlo)
  const code = d.code
    ? `${p(`Tu código de bienvenida para obtener <strong>${d.percent}% de descuento</strong>${d.firstPurchaseOnly ? " en tu primera compra" : ""}:`)}${codeBox(d.code)}`
    : "";
  const html = layout({
    preheader: "Ahora haces parte de nuestra comunidad",
    title: "¡Bienvenida a NOVA FIT! 🤍",
    body:
      p(`Hola, ${esc(who)}. Nos alegra mucho tenerte aquí.`) +
      p("Tu registro en nuestra página web ha sido exitoso. Ahora haces parte de nuestra comunidad, un espacio creado para mujeres que buscan sentirse bien, seguras y mostrar su mejor versión.") +
      p("A partir de ahora podrás conocer nuestras colecciones, descubrir nuevos lanzamientos y disfrutar de una experiencia de compra más fácil y especial.") +
      code +
      p("Gracias por elegirnos y permitirnos acompañarte.") +
      signature(["NOVA FIT", "Muestra tu mejor versión. 🤍"]),
    button: { text: "Ver colecciones", url: `${frontendUrl}/catalogo` },
    unsubscribeUrl: d.unsubscribeUrl,
  });
  const text = `¡BIENVENIDA A NOVA FIT! 🤍

Hola, ${who}. Nos alegra mucho tenerte aquí.

Tu registro en nuestra página web ha sido exitoso. Ahora haces parte de nuestra comunidad, un espacio creado para mujeres que buscan sentirse bien, seguras y mostrar su mejor versión.

A partir de ahora podrás conocer nuestras colecciones, descubrir nuevos lanzamientos y disfrutar de una experiencia de compra más fácil y especial.
${d.code ? `\nTu código de bienvenida (${d.percent}% de descuento${d.firstPurchaseOnly ? " en tu primera compra" : ""}): ${d.code}\n` : ""}
Gracias por elegirnos y permitirnos acompañarte.

NOVA FIT
Muestra tu mejor versión. 🤍

Colecciones: ${frontendUrl}/catalogo
Darte de baja: ${d.unsubscribeUrl}`;
  return { subject: "¡Bienvenida a NOVA FIT! 🤍", html, text };
}

// ---------- 2. Compra exitosa (pago aprobado) ----------

const productLines = (order: Order) =>
  order.items.map((i) => `${i.quantity} × ${i.productName} (talla ${i.size})`);

export function paymentEmail(order: Order) {
  const { frontendUrl } = emailConfig();
  const who = greetingName(order.customerName, order.email);
  const url = `${frontendUrl}/pedido/${encodeURIComponent(order.reference)}`;
  const address = `${order.address}, ${order.city}, ${order.department}`;
  const html = layout({
    preheader: `Pedido ${order.reference} recibido`,
    title: "¡Tu compra fue exitosa! 🤍",
    body:
      p(`Hola, ${esc(who)}.`) +
      p("En NOVA FIT estamos felices de que nos hayas elegido. Tu pedido ha sido recibido correctamente y estamos preparando todo para que disfrutes de tu nueva prenda favorita.") +
      sectionTitle("RESUMEN DE TU PEDIDO") +
      dataRows([
        ["Número de pedido", `<strong>${esc(order.reference)}</strong>`],
        ["Fecha", esc(fecha(order.paidAt || order.createdAt))],
        ["Productos", productLines(order).map(esc).join("<br>")],
        ...(order.discountAmount ? ([["Descuento", `${esc(order.discountCode)} (−${money(order.discountAmount)})`]] as [string, string][]) : []),
        ["Total pagado", `<strong>${money(order.total)}</strong>`],
        ["Dirección de envío", esc(address)],
      ]) +
      p("Te mantendremos informada sobre el estado de tu pedido y el proceso de envío.") +
      p("Gracias por confiar en NOVA FIT y permitirnos acompañarte a mostrar tu mejor versión.") +
      signature(["Con cariño,", "NOVA FIT", "Your season, your moment."]),
    button: { text: "Ver mi pedido", url },
  });
  const text = `Hola, ${who}.

¡Tu compra fue exitosa! 🤍

En NOVA FIT estamos felices de que nos hayas elegido. Tu pedido ha sido recibido correctamente y estamos preparando todo para que disfrutes de tu nueva prenda favorita.

RESUMEN DE TU PEDIDO

Número de pedido: ${order.reference}
Fecha: ${fecha(order.paidAt || order.createdAt)}
Productos: ${productLines(order).join("; ")}
${order.discountAmount ? `Descuento: ${order.discountCode} (−${money(order.discountAmount)})\n` : ""}Total pagado: ${money(order.total)}
Dirección de envío: ${address}

Te mantendremos informada sobre el estado de tu pedido y el proceso de envío.

Gracias por confiar en NOVA FIT y permitirnos acompañarte a mostrar tu mejor versión.

Con cariño,

NOVA FIT
Your season, your moment.

Ver pedido: ${url}`;
  return { subject: `¡Tu compra fue exitosa! 🤍 Pedido ${order.reference}`, html, text };
}

// ---------- 3. Pedido en camino (número de guía) ----------

export function shippedEmail(order: Order) {
  const who = greetingName(order.customerName, order.email);
  const tracking = order.trackingUrl
    ? `<a href="${esc(order.trackingUrl)}" style="color:#1e1e1e">${esc(order.trackingUrl)}</a>`
    : "";
  const rows: [string, string][] = [
    ["Número de pedido", `<strong>${esc(order.reference)}</strong>`],
    ...(order.carrier ? ([["Transportadora", esc(order.carrier)]] as [string, string][]) : []),
    ["Número de guía", `<strong style="font-family:monospace;font-size:15px">${esc(order.trackingNumber)}</strong>`],
    ...(tracking ? ([["Enlace de seguimiento", tracking]] as [string, string][]) : []),
  ];
  const html = layout({
    preheader: `Guía ${order.trackingNumber}`,
    title: "¡Tu pedido NOVA FIT ya está en camino! 📦",
    body:
      p(`Hola, ${esc(who)}.`) +
      p("¡Tenemos buenas noticias para ti! 🤍") +
      p("Tu pedido NOVA FIT ya fue despachado y está en camino hacia ti. Esperamos que disfrutes muchísimo tus nuevas prendas y que cada una te haga sentir increíble.") +
      sectionTitle("INFORMACIÓN DE TU ENVÍO") +
      dataRows(rows) +
      p("Te invitamos a realizar el seguimiento de tu paquete para estar al tanto de su recorrido.") +
      p("Gracias por confiar en NOVA FIT y permitirnos ser parte de tu día a día.") +
      p("¡Esperamos que ames tu pedido tanto como nosotros amamos crearlo para ti!") +
      signature(["NOVA FIT", "Muestra tu mejor versión."]),
    ...(order.trackingUrl ? { button: { text: "Seguir mi envío", url: order.trackingUrl } } : {}),
  });
  const text = `¡Tu pedido NOVA FIT ya está en camino! 📦

Hola, ${who}.

¡Tenemos buenas noticias para ti! 🤍

Tu pedido NOVA FIT ya fue despachado y está en camino hacia ti. Esperamos que disfrutes muchísimo tus nuevas prendas y que cada una te haga sentir increíble.

INFORMACIÓN DE TU ENVÍO

Número de pedido: ${order.reference}
${order.carrier ? `Transportadora: ${order.carrier}\n` : ""}Número de guía: ${order.trackingNumber}
${order.trackingUrl ? `Enlace de seguimiento: ${order.trackingUrl}\n` : ""}
Te invitamos a realizar el seguimiento de tu paquete para estar al tanto de su recorrido.

Gracias por confiar en NOVA FIT y permitirnos ser parte de tu día a día.

¡Esperamos que ames tu pedido tanto como nosotros amamos crearlo para ti!

NOVA FIT
Muestra tu mejor versión.`;
  return { subject: "¡Tu pedido NOVA FIT ya está en camino! 📦", html, text };
}

// ---------- 4. Promoción (redactada en el panel; por defecto el texto de "beneficio exclusivo") ----------

export function promotionEmail(d: {
  subject: string; title: string; message: string; code?: string; buttonText?: string; buttonUrl?: string;
  name?: string; email?: string; unsubscribeUrl: string;
}) {
  const { frontendUrl } = emailConfig();
  const who = greetingName(d.name, d.email);
  const buttonUrl = d.buttonUrl || `${frontendUrl}/catalogo`;
  const html = layout({
    preheader: d.subject,
    title: d.title,
    body:
      (who ? p(`Hola, ${esc(who)}.`) : "") +
      paragraphs(d.message) +
      (d.code ? codeBox(d.code) : "") +
      signature(["NOVA FIT", "Muestra tu mejor versión."]),
    button: { text: d.buttonText || "Comprar ahora", url: buttonUrl },
    unsubscribeUrl: d.unsubscribeUrl,
  });
  const text = `${who ? `Hola, ${who}.\n\n` : ""}${d.title}

${d.message}${d.code ? `\n\nTu código: ${d.code}` : ""}

NOVA FIT
Muestra tu mejor versión.

${d.buttonText || "Comprar ahora"}: ${buttonUrl}
Darte de baja: ${d.unsubscribeUrl}`;
  return { subject: d.subject, html, text };
}
