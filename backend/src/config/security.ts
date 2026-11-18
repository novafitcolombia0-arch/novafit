import { Request } from "express";
import rateLimit from "express-rate-limit";

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

/** ¿La petición trae una sesión? (solo para decidir el tamaño máximo del cuerpo antes de validarla) */
export const hasBearer = (req: Request) => (req.headers.authorization || "").startsWith("Bearer ");
