import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from "typeorm";

// Tipos de movimiento del inventario:
//  ENTRADA     llegó mercancía (producción, compra)
//  SALIDA      salió por fuera de la web (venta en persona, daño, regalo...)
//  AJUSTE      conteo físico: se fija el stock al número contado
//  VENTA_WEB   prendas apartadas/vendidas por un pedido en la tienda online
//  LIBERACION  un pedido no se pagó y las prendas volvieron al stock
//  CREACION    stock inicial al crear un producto o una talla nueva
//  ELIMINACION se quitó una talla que aún tenía unidades
//  VENTA_MANUAL venta registrada en Finanzas (WhatsApp, en persona...)
//  ANULACION   se anuló una venta manual y las prendas volvieron
export type MovementType =
  | "ENTRADA"
  | "SALIDA"
  | "AJUSTE"
  | "VENTA_WEB"
  | "LIBERACION"
  | "CREACION"
  | "ELIMINACION"
  | "VENTA_MANUAL"
  | "ANULACION";

@Entity({ name: "inventory_movements" })
@Index(["productId", "createdAt"])
export class InventoryMovement {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  productId: number;

  // Copia del nombre para que el historial siga legible si se borra el producto
  @Column()
  productName: string;

  @Column()
  size: string;

  // Color de la variante ("" si la prenda no maneja colores)
  @Column({ default: "" })
  color: string;

  @Column()
  type: MovementType;

  // Cambio en unidades: positivo entra, negativo sale
  @Column({ type: "int" })
  quantity: number;

  // Stock de la talla después del movimiento
  @Column({ type: "int", nullable: true })
  stockAfter: number | null;

  // Referencia del pedido web, si aplica
  @Column({ nullable: true })
  reference: string;

  @Column({ type: "text", nullable: true })
  note: string;

  @CreateDateColumn({ type: "timestamptz" })
  createdAt: Date;
}
