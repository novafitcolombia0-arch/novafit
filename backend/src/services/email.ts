import { Order } from "../entities";
import { emailConfig } from "./mail";

// Plantillas HTML de los correos de la tienda (el envío está en ./mail)
export { emailConfig, sendEmail, enqueueEmail } from "./mail";
export type { EmailMessage, SendResult } from "./mail";

// ---------- Plantillas ----------

const esc = (v: unknown) =>
  String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const money = (n: number) => `$${Math.round(n).toLocaleString("es-CO")} COP`;
const paragraphs = (text: string) =>
  esc(text).split(/\n{2,}/).map((p) => `<p style="margin:0 0 14px">${p.replace(/\n/g, "<br>")}</p>`).join("");

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
<p style="font-size:12px;color:#696969;margin:18px 0 0;line-height:1.6">Nova FIT · Muestra tu mejor versión<br>
WhatsApp +57 318 701 6549 · novafitcolombia0@gmail.com${unsubscribe}</p>
</td></tr></table></body></html>`;
}

/** Bienvenida al suscribirse (con el cupón, si había uno activo) */
export function welcomeEmail(p: { name?: string; code?: string; percent?: number; firstPurchaseOnly?: boolean; unsubscribeUrl: string }) {
  const { frontendUrl } = emailConfig();
  const hello = p.name ? `Hola ${esc(p.name)},` : "Hola,";
  const codeBlock = p.code
    ? `<p style="margin:0 0 14px">Aquí tienes tu <strong>${p.percent}% de descuento</strong>${p.firstPurchaseOnly ? " en tu primera compra" : ""}:</p>
<p style="text-align:center;margin:18px 0"><span style="display:inline-block;font-family:monospace;font-size:22px;letter-spacing:2px;border:2px dashed #b59677;border-radius:4px;padding:10px 20px">${esc(p.code)}</span></p>
<p style="margin:0 0 14px">Escríbelo en el campo "Código de descuento" al finalizar tu compra.</p>`
    : "";
  const html = layout({
    preheader: p.code ? `Tu código de ${p.percent}% está adentro` : "Gracias por suscribirte",
    title: "¡Bienvenida a Nova FIT!",
    body: `<p style="margin:0 0 14px">${hello}</p><p style="margin:0 0 14px">Gracias por suscribirte. Serás la primera en enterarte de nuestros lanzamientos y promociones.</p>${codeBlock}`,
    button: { text: "Shop Now", url: `${frontendUrl}/catalogo` },
    unsubscribeUrl: p.unsubscribeUrl,
  });
  const text = `${p.name ? `Hola ${p.name},` : "Hola,"}\n\nGracias por suscribirte a Nova FIT.${p.code ? `\n\nTu código de ${p.percent}% de descuento${p.firstPurchaseOnly ? " en tu primera compra" : ""}: ${p.code}` : ""}\n\nCompra aquí: ${frontendUrl}/catalogo\n\nDarte de baja: ${p.unsubscribeUrl}`;
  return { subject: p.code ? `Tu ${p.percent}% de descuento en Nova FIT` : "¡Bienvenida a Nova FIT!", html, text };
}

function orderLines(order: Order) {
  const rows = order.items
    .map((i) => `<tr><td style="padding:6px 0">${i.quantity} × ${esc(i.productName)} <span style="color:#696969">(talla ${esc(i.size)})</span></td><td style="padding:6px 0;text-align:right;white-space:nowrap">${money(i.unitPrice * i.quantity)}</td></tr>`)
    .join("");
  const discount = order.discountAmount
    ? `<tr><td style="padding:4px 0;color:#2f7d32">Descuento ${esc(order.discountCode)}</td><td style="padding:4px 0;text-align:right;color:#2f7d32">−${money(order.discountAmount)}</td></tr>`
    : "";
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:14px;border-top:1px solid #e6e6e6;border-bottom:1px solid #e6e6e6;margin:8px 0 18px">${rows}
<tr><td style="padding:8px 0 4px;color:#696969;border-top:1px solid #e6e6e6">Subtotal</td><td style="padding:8px 0 4px;text-align:right;color:#696969;border-top:1px solid #e6e6e6">${money(order.subtotal)}</td></tr>${discount}
<tr><td style="padding:4px 0;color:#696969">Envío</td><td style="padding:4px 0;text-align:right;color:#696969">${order.shippingCost ? money(order.shippingCost) : "Gratis"}</td></tr>
<tr><td style="padding:8px 0;font-weight:bold">Total pagado</td><td style="padding:8px 0;text-align:right;font-weight:bold">${money(order.total)}</td></tr></table>`;
}

/** Confirmación cuando el pago queda aprobado */
export function paymentEmail(order: Order) {
  const { frontendUrl } = emailConfig();
  const first = order.customerName.split(" ")[0];
  const url = `${frontendUrl}/pedido/${encodeURIComponent(order.reference)}`;
  const html = layout({
    preheader: `Pedido ${order.reference} confirmado`,
    title: "¡Recibimos tu pago!",
    body: `<p style="margin:0 0 14px">Hola ${esc(first)}, tu pedido <strong>${esc(order.reference)}</strong> está confirmado y ya lo estamos preparando.</p>
${orderLines(order)}
<p style="margin:0 0 6px"><strong>Envío a:</strong></p>
<p style="margin:0 0 14px;color:#696969">${esc(order.address)}<br>${esc(order.city)}, ${esc(order.department)}</p>
<p style="margin:0 0 14px">Te escribiremos de nuevo con el número de guía cuando tu pedido salga.</p>`,
    button: { text: "Ver mi pedido", url },
  });
  const items = order.items.map((i) => `- ${i.quantity} × ${i.productName} (talla ${i.size}): ${money(i.unitPrice * i.quantity)}`).join("\n");
  const text = `Hola ${first}, recibimos tu pago.\n\nPedido ${order.reference}\n${items}\n${order.discountAmount ? `Descuento ${order.discountCode}: -${money(order.discountAmount)}\n` : ""}Envío: ${order.shippingCost ? money(order.shippingCost) : "Gratis"}\nTotal pagado: ${money(order.total)}\n\nEnvío a: ${order.address}, ${order.city}, ${order.department}\n\nVer pedido: ${url}`;
  return { subject: `Pago confirmado · Pedido ${order.reference}`, html, text };
}

/** Aviso con el número de guía cuando el pedido sale */
export function shippedEmail(order: Order) {
  const { frontendUrl } = emailConfig();
  const first = order.customerName.split(" ")[0];
  const url = `${frontendUrl}/pedido/${encodeURIComponent(order.reference)}`;
  const html = layout({
    preheader: `Guía ${order.trackingNumber}`,
    title: "¡Tu pedido va en camino!",
    body: `<p style="margin:0 0 14px">Hola ${esc(first)}, tu pedido <strong>${esc(order.reference)}</strong> ya salió.</p>
<p style="margin:0 0 6px">Número de guía:</p>
<p style="text-align:center;margin:12px 0 20px"><span style="display:inline-block;font-family:monospace;font-size:20px;letter-spacing:1px;background:#f8f0e4;border-radius:4px;padding:10px 20px">${esc(order.trackingNumber)}</span></p>
<p style="margin:0 0 14px">Con este número puedes seguir tu envío en la página de la transportadora. Si tienes cualquier duda, escríbenos por WhatsApp.</p>
<p style="margin:0 0 14px;color:#696969">Envío a: ${esc(order.address)}, ${esc(order.city)}, ${esc(order.department)}</p>`,
    button: { text: "Ver mi pedido", url },
  });
  const text = `Hola ${first}, tu pedido ${order.reference} va en camino.\n\nNúmero de guía: ${order.trackingNumber}\n\nEnvío a: ${order.address}, ${order.city}, ${order.department}\n\nVer pedido: ${url}`;
  return { subject: `Tu pedido ${order.reference} va en camino`, html, text };
}

/** Promoción escrita en el panel */
export function promotionEmail(p: { subject: string; title: string; message: string; code?: string; buttonText?: string; buttonUrl?: string; name?: string; unsubscribeUrl: string }) {
  const { frontendUrl } = emailConfig();
  const hello = p.name ? `<p style="margin:0 0 14px">Hola ${esc(p.name)},</p>` : "";
  const code = p.code
    ? `<p style="text-align:center;margin:18px 0"><span style="display:inline-block;font-family:monospace;font-size:22px;letter-spacing:2px;border:2px dashed #b59677;border-radius:4px;padding:10px 20px">${esc(p.code)}</span></p>`
    : "";
  const buttonUrl = p.buttonUrl || `${frontendUrl}/catalogo`;
  const html = layout({
    preheader: p.subject,
    title: p.title,
    body: `${hello}${paragraphs(p.message)}${code}`,
    button: { text: p.buttonText || "Shop Now", url: buttonUrl },
    unsubscribeUrl: p.unsubscribeUrl,
  });
  const text = `${p.name ? `Hola ${p.name},\n\n` : ""}${p.title}\n\n${p.message}${p.code ? `\n\nCódigo: ${p.code}` : ""}\n\n${p.buttonText || "Shop Now"}: ${buttonUrl}\n\nDarte de baja: ${p.unsubscribeUrl}`;
  return { subject: p.subject, html, text };
}
