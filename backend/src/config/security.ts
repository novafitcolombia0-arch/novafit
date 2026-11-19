import { Request } from "express";
import rateLimit from "express-rate-limit";
import jwt from "jsonwebtoken";

/**
 * Clave para firmar las sesiones del panel. Sin ella (o si es corta) cualquiera podría
 * fabricar una sesión de admin, así que el servidor se niega a arrancar.
 */
export function jwtSecret(): string {
  const secret = process.env.JWT_SECRET || "";
  if (secret.length < 32) {
    throw new Error("JWT_SECRET falta o es demasiado corto (mínimo 32 caracteres). Configúralo en el .env o en Railway.");
  }
  return secret;
}

// Mensaje en español y cabeceras estándar RateLimit-* para que el navegador sepa cuándo reintentar
const limiter = (windowMinutes: number, limit: number, message: string, extra: Parameters<typeof rateLimit>[0] = {}) =>
  rateLimit({
    windowMs: windowMinutes * 60_000,
    limit,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    message: { message },
    ...extra,
  });

/**
 * Orígenes que pueden llamar a la API desde el navegador: FRONTEND_URL (con y sin www), localhost
 * para desarrollo y los de CORS_ORIGINS (separados por coma; admite comodín, p. ej.
 * https://novafit-*.vercel.app para las versiones de prueba de Vercel).
 * Las peticiones sin Origin (webhook de Wompi, imágenes, enlaces de baja) no se ven afectadas.
 * Si no hay FRONTEND_URL ni CORS_ORIGINS se deja abierto para no tumbar la tienda.
 */
export function corsOrigin(): true | (string | RegExp)[] {
  const configured = [process.env.FRONTEND_URL || "", ...(process.env.CORS_ORIGINS || "").split(",")]
    .map((o) => o.trim().replace(/\/$/, ""))
    .filter(Boolean);
  if (!configured.length) {
    console.warn("CORS: sin FRONTEND_URL ni CORS_ORIGINS, la API acepta peticiones de cualquier sitio");
    return true;
  }
  const origins: (string | RegExp)[] = ["http://localhost:4200", "http://127.0.0.1:4200"];
  for (const o of configured) {
    if (o.includes("*")) {
      const pattern = o.split("*").map((part) => part.replace(/[.+?^${}()|[\]\\/]/g, "\\$&")).join("[a-z0-9-]+");
      origins.push(new RegExp(`^${pattern}$`, "i"));
      continue;
    }
    origins.push(o);
    // novafitmb.com <-> www.novafitmb.com
    const www = o.replace(/^(https?:\/\/)(www\.)?/, (_m, proto, w) => (w ? proto : `${proto}www.`));
    origins.push(www);
  }
  return origins;
}

/** Login: 5 intentos fallidos cada 15 minutos por IP (los correctos no cuentan) */
export const loginLimiter = limiter(15, 5, "Demasiados intentos de inicio de sesión. Espera 15 minutos e inténtalo de nuevo.", {
  skipSuccessfulRequests: true,
});

/** Cambiar contraseña: 5 intentos cada 15 minutos */
export const passwordLimiter = limiter(15, 5, "Demasiados intentos. Espera 15 minutos e inténtalo de nuevo.");

/** Iniciar un pago: cada intento aparta inventario, así que se limita por IP */
export const checkoutLimiter = limiter(15, 10, "Demasiados intentos de pago seguidos. Espera unos minutos e inténtalo de nuevo.");

/** Validar códigos de descuento: evita probar códigos por fuerza bruta */
export const discountLimiter = limiter(15, 20, "Demasiados intentos con códigos de descuento. Espera unos minutos.");

/** Suscripciones desde el modal: evita llenar la lista de spam */
export const subscribeLimiter = limiter(60, 5, "Demasiadas suscripciones desde tu conexión. Inténtalo más tarde.");

/** Límite general de la API (protege contra ráfagas automatizadas) */
export const apiLimiter = limiter(1, 300, "Demasiadas peticiones. Espera un momento.");

/**
 * ¿La petición trae una sesión firmada por este servidor? Decide el tamaño máximo del cuerpo:
 * solo con una firma válida se aceptan cuerpos grandes (fotos del panel). Comprobar la firma es
 * barato y no toca la base; la sesión completa (usuario, rol, versión) la valida authMiddleware.
 */
export function hasValidBearer(req: Request): boolean {
  const header = req.headers.authorization || "";
  if (!header.startsWith("Bearer ")) return false;
  try {
    jwt.verify(header.slice(7), jwtSecret(), { algorithms: ["HS256"] });
    return true;
  } catch {
    return false;
  }
}
