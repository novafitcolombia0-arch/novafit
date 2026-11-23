import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from "typeorm";
import { Order } from "./Order";

// Copia de los datos del producto al momento de la compra: si después
// cambian el precio o el nombre, el pedido conserva lo que se pagó.
@Entity({ name: "order_items" })
export class OrderItem {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Order, (order) => order.items, { onDelete: "CASCADE" })
  @JoinColumn({ name: "orderId" })
  order: Order;

  @Column()
  orderId: number;

  @Column()
  productId: number;

  @Column()
  productName: string;

  @Column()
  size: string;

  // Color comprado ("" si la prenda no maneja colores)
  @Column({ default: "" })
  color: string;

  @Column({ type: "int" })
  unitPrice: number;

  // Costo unitario al momento de vender (para calcular la utilidad real)
  @Column({ type: "int", nullable: true })
  unitCost: number | null;

  @Column({ type: "int" })
  quantity: number;
}
