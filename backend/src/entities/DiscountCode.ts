import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from "typeorm";

/** Código de descuento por porcentaje sobre las prendas (no sobre el envío) */
@Entity("discount_codes")
export class DiscountCode {
  @PrimaryGeneratedColumn()
  id: number;

  // Siempre en mayúsculas, sin espacios
  @Column({ unique: true })
  code: string;

  @Column({ type: "int" })
  percent: number;

  @Column({ default: true })
  active: boolean;

  // Solo válido si el correo no tiene ninguna compra pagada
  @Column({ default: false })
  firstPurchaseOnly: boolean;

  // Usos máximos en total (null = ilimitado); cuenta solo pedidos pagados
  @Column({ type: "int", nullable: true })
  maxUses: number | null;

  @Column({ type: "int", default: 0 })
  usedCount: number;

  @Column({ type: "timestamptz", nullable: true })
  expiresAt: Date | null;

  // El código que entrega el modal de suscripción (solo uno a la vez)
  @Column({ default: false })
  isWelcome: boolean;

  @Column({ nullable: true })
  description: string;

  @CreateDateColumn({ type: "timestamptz" })
  createdAt: Date;
}
