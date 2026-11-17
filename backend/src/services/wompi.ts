import crypto from "crypto";

// Configuración de Wompi tomada de las variables de entorno.
// Las llaves de prueba empiezan por pub_test_ / prv_test_ y las de producción por pub_prod_.
export function wompiConfig() {
  const publicKey = process.env.WOMPI_PUBLIC_KEY || "";
  const integritySecret = process.env.WOMPI_INTEGRITY_SECRET || "";
  const eventsSecret = process.env.WOMPI_EVENTS_SECRET || "";
  const isProduction = publicKey.startsWith("pub_prod_");
  const env = isProduction ? "prod" : "test";

  // Errores típicos al copiar las llaves del panel: secreto equivocado o pruebas mezcladas con producción
  const problems: string[] = [];
  if (publicKey && !/^pub_(test|prod)_/.test(publicKey)) {
    problems.push("WOMPI_PUBLIC_KEY debe empezar por pub_test_ (Sandbox) o pub_prod_ (producción)");
  }
  if (integritySecret && !integritySecret.startsWith(`${env}_integrity_`)) {
    problems.push(`WOMPI_INTEGRITY_SECRET debe empezar por ${env}_integrity_ (no es la llave privada prv_)`);
  }
  const warnings: string[] = [];
  if (!eventsSecret) warnings.push("WOMPI_EVENTS_SECRET vacío: los eventos (webhook) de Wompi se rechazarán");
  else if (!eventsSecret.startsWith(`${env}_events_`)) {
    warnings.push(`WOMPI_EVENTS_SECRET debe empezar por ${env}_events_: los eventos (webhook) de Wompi se rechazarán`);
  }

  return {
    publicKey,
    integritySecret,
    eventsSecret,
    apiUrl: isProduction ? "https://production.wompi.co/v1" : "https://sandbox.wompi.co/v1",
    checkoutUrl: "https://checkout.wompi.co/p/",
    configured: !!publicKey && !!integritySecret && problems.length === 0,
    problems,
    warnings,
  };
}

const sha256 = (value: string) => crypto.createHash("sha256").update(value).digest("hex");

/** Firma de integridad: SHA256(referencia + montoEnCentavos + moneda + secretoDeIntegridad) */
export function integritySignature(reference: string, amountInCents: number, currency = "COP") {
  return sha256(`${reference}${amountInCents}${currency}${wompiConfig().integritySecret}`);
}

/**
 * Valida el checksum de un evento de Wompi:
 * SHA256(valores de signature.properties en orden + timestamp + secretoDeEventos)
 */
export function isValidEvent(body: any): boolean {
  const { eventsSecret } = wompiConfig();
  const properties: string[] | undefined = body?.signature?.properties;
  const checksum: string | undefined = body?.signature?.checksum;
  if (!eventsSecret || !Array.isArray(properties) || !checksum || body?.timestamp == null) return false;

  const values = properties
    .map((path) => path.split(".").reduce((obj: any, key) => obj?.[key], body.data))
    .join("");
  const expected = sha256(`${values}${body.timestamp}${eventsSecret}`);
  const a = Buffer.from(expected.toLowerCase());
  const b = Buffer.from(String(checksum).toLowerCase());
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export interface WompiTransaction {
  id: string;
  status: string;
  reference: string;
  amount_in_cents: number;
  currency: string;
  payment_method_type?: string;
}

/** Consulta una transacción directamente en Wompi (fuente confiable, no depende del navegador) */
export async function fetchTransaction(id: string): Promise<WompiTransaction | null> {
  try {
    const res = await fetch(`${wompiConfig().apiUrl}/transactions/${encodeURIComponent(id)}`);
    if (!res.ok) return null;
    const json: any = await res.json();
    return json?.data ?? null;
  } catch {
    return null;
  }
}
