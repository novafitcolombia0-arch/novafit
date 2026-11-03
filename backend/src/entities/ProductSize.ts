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

  @Column({ default: 0 })
  stock: number;

  @ManyToOne(() => Product, (product) => product.sizes)
  @JoinColumn({ name: "productId" })
  product: Product;

  @Column()
  productId: number;
}
