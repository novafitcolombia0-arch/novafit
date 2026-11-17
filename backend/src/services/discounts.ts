import crypto from "crypto";
import { EntityManager } from "typeorm";
import { AppDataSource } from "../config/data-source";
import { DiscountCode, Order } from "../entities";

export const normalizeCode = (value: unknown) =>
  String(value ?? "").trim().toUpperCase().replace(/\s+/g, "").slice(0, 40);

/** Código legible y difícil de adivinar: PREFIJO-7KQ2XM (sin 0/O ni 1/I) */
export function generateCode(prefix = "NOVA") {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = crypto.randomBytes(6);
  const suffix = Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
  return `${normalizeCode(prefix).replace(/[^A-Z0-9]/g, "").slice(0, 16) || "NOVA"}-${suffix}`;
}

export type DiscountResult =
  | { ok: true; discount: DiscountCode; amount: number }
  | { ok: false; message: string };

/** ¿Este correo ya tiene alguna compra pagada? */
async function hasPaidOrder(email: string) {
  const count = await AppDataSource.getRepository(Order)
    .createQueryBuilder("o")
    .where("LOWER(o.email) = :email AND o.status = 'APPROVED'", { email: email.toLowerCase() })
    .getCount();
  return count > 0;
}

/**
 * Valida un código para un correo y un subtotal de prendas.
 * El descuento se aplica solo a las prendas, nunca al envío.
 */
export async function evaluateDiscount(rawCode: unknown, email: string, subtotal: number): Promise<DiscountResult> {
  const code = normalizeCode(rawCode);
  if (!code) return { ok: false, message: "Escribe un código de descuento" };

  const discount = await AppDataSource.getRepository(DiscountCode).findOne({ where: { code } });
  if (!discount || !discount.active) return { ok: false, message: "Este código no existe o ya no está activo" };
  if (discount.expiresAt && discount.expiresAt.getTime() < Date.now()) {
    return { ok: false, message: "Este código ya venció" };
  }
  if (discount.maxUses !== null && discount.usedCount >= discount.maxUses) {
    return { ok: false, message: "Este código ya alcanzó su límite de usos" };
  }
  if (discount.firstPurchaseOnly) {
    if (!email) return { ok: false, message: "Escribe tu correo para validar el código de primera compra" };
    if (await hasPaidOrder(email)) return { ok: false, message: "Este código es solo para tu primera compra" };
  }
  return { ok: true, discount, amount: Math.round((subtotal * discount.percent) / 100) };
}

/** Suma un uso al código (cuando el pedido queda pagado) */
export async function markDiscountUsed(manager: EntityManager, code: string | null | undefined) {
  if (!code) return;
  await manager.increment(DiscountCode, { code }, "usedCount", 1);
}
