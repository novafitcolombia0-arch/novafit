import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from "typeorm";
import { Product } from "./Product";

@Entity()
export class ProductImage {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: "text" })
  imageData: string;

  @Column({ default: "image/jpeg" })
  mimeType: string;

  @Column({ default: false })
  isMain: boolean;

  @ManyToOne(() => Product, (product) => product.images, { onDelete: "CASCADE" })
  @JoinColumn({ name: "productId" })
  product: Product;

  @Column()
  productId: number;
}
