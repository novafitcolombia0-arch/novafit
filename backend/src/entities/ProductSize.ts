import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from "typeorm";
import { Product } from "./Product";

@Entity()
export class ProductSize {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  size: string;

  // Color de la variante ("" = la prenda no maneja colores). Cada color + talla tiene su propio stock
  @Column({ default: "" })
  color: string;

  @Column({ default: 0 })
  stock: number;

  @ManyToOne(() => Product, (product) => product.sizes, { onDelete: "CASCADE" })
  @JoinColumn({ name: "productId" })
  product: Product;

  @Column()
  productId: number;
}
