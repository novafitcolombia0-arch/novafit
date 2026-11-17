import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToMany,
  CreateDateColumn,
  UpdateDateColumn,
} from "typeorm";
import { OrderItem } from "./OrderItem";

// Estados de pago: espejo de los estados de transacción de Wompi
// (PENDING, APPROVED, DECLINED, VOIDED, ERROR) + EXPIRED cuando la
// clienta nunca terminó de pagar y se liberó el inventario reservado.
export type PaymentStatus =
  | "PENDING"
  | "APPROVED"
  | "DECLINED"
  | "VOIDED"
  | "ERROR"
  | "EXPIRED";

// Estado logístico, lo maneja el admin a mano
export type FulfillmentStatus = "POR_DESPACHAR" | "DESPACHADO" | "ENTREGADO" | "CANCELADO";

@Entity({ name: "orders" })
export class Order {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  reference: string;

  @Column({ default: "PENDING" })
  status: PaymentStatus;

  // WEB = tienda online con Wompi · MANUAL = venta registrada a mano (WhatsApp, en persona...)
  @Column({ default: "WEB" })
  channel: "WEB" | "MANUAL";

  @Column({ default: "POR_DESPACHAR" })
  fulfillmentStatus: FulfillmentStatus;

  @Column({ nullable: true })
  trackingNumber: string;

  // Datos de la clienta
  @Column()
  customerName: string;

  @Column({ nullable: true })
  email: string;

  @Column({ nullable: true })
  phone: string;

  @Column({ nullable: true })
  documentId: string;

  @Column({ nullable: true })
  department: string;

  @Column({ nullable: true })
  city: string;

  @Column({ nullable: true })
  address: string;

  @Column({ type: "text", nullable: true })
  notes: string;

  // Valores en pesos (COP, sin decimales)
  @Column({ type: "int" })
  subtotal: number;

  @Column({ type: "int", default: 0 })
  shippingCost: number;

  // Código de descuento aplicado y cuánto se descontó de las prendas
  @Column({ nullable: true })
  discountCode: string;

  @Column({ type: "int", default: 0 })
  discountAmount: number;

  @Column({ type: "int" })
  total: number;

  // Datos de la transacción en Wompi
  @Column({ nullable: true })
  wompiTransactionId: string;

  @Column({ nullable: true })
  paymentMethod: string;

  // true mientras el inventario de este pedido está descontado
  @Column({ default: true })
  stockReserved: boolean;

  @Column({ type: "timestamptz", nullable: true })
  paidAt: Date | null;

  @CreateDateColumn({ type: "timestamptz" })
  createdAt: Date;

  @UpdateDateColumn({ type: "timestamptz" })
  updatedAt: Date;

  @OneToMany(() => OrderItem, (item) => item.order, { eager: true, cascade: true })
  items: OrderItem[];
}
