import { EntityManager } from "typeorm";
import { InventoryMovement, MovementType, ProductSize } from "../entities";

interface StockChange {
  productId: number;
  productName: string;
  size: string;
  type: MovementType;
  reference?: string;
  note?: string;
}

export async function logMovement(
  manager: EntityManager,
  change: StockChange & { quantity: number; stockAfter: number | null }
) {
  await manager.insert(InventoryMovement, {
    productId: change.productId,
    productName: change.productName,
    size: change.size,
    type: change.type,
    quantity: change.quantity,
    stockAfter: change.stockAfter,
    reference: change.reference || undefined,
    note: change.note || undefined,
  });
}

/**
 * Suma o resta unidades a una talla y deja el movimiento en el historial.
 *  - mode "strict": falla (devuelve null) si no hay unidades suficientes
 *  - mode "floor":  descuenta lo que pueda sin bajar de 0
 *  - mode "free":   suma sin condiciones (entradas y liberaciones)
 * Devuelve el stock resultante, o null si la talla no existe / no alcanzó.
 */
export async function changeStock(
  manager: EntityManager,
  change: StockChange & { delta: number; mode?: "strict" | "floor" | "free" }
): Promise<number | null> {
  const delta = Math.trunc(change.delta);
  if (!delta) return null;
  const mode = change.mode || "free";

  let set: string;
  let condition = `"productId" = :productId AND size = :size`;
  if (mode === "floor") {
    set = `GREATEST(stock + (${delta}), 0)`;
  } else {
    set = `stock + (${delta})`;
    if (mode === "strict" && delta < 0) condition += ` AND stock >= ${-delta}`;
  }

  const result = await manager
    .createQueryBuilder()
    .update(ProductSize)
    .set({ stock: () => set })
    .where(condition, { productId: change.productId, size: change.size })
    .returning("stock")
    .execute();

  if (!result.affected) return null;
  const stockAfter = Number(result.raw?.[0]?.stock ?? null);
  await logMovement(manager, { ...change, quantity: delta, stockAfter });
  return stockAfter;
}

/** Conteo físico: fija el stock de una talla en un valor exacto */
export async function setStock(
  manager: EntityManager,
  change: StockChange & { stock: number }
): Promise<number | null> {
  const row = await manager.findOne(ProductSize, {
    where: { productId: change.productId, size: change.size },
    lock: { mode: "pessimistic_write" },
    loadEagerRelations: false,
  });
  if (!row) return null;
  const target = Math.max(0, Math.trunc(change.stock));
  const delta = target - row.stock;
  await manager.update(ProductSize, row.id, { stock: target });
  await logMovement(manager, { ...change, quantity: delta, stockAfter: target });
  return target;
}
