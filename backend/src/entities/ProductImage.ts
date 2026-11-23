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

  // select: false → los listados no cargan los datos; se sirven en /api/images
  @Column({ type: "text", select: false })
  imageData: string;

  @Column({ default: "image/jpeg" })
  mimeType: string;

  @Column({ default: false })
  isMain: boolean;

  // Color al que pertenece la foto ("" = se muestra con todos los colores)
  @Column({ default: "" })
  color: string;

  @ManyToOne(() => Product, (product) => product.images, { onDelete: "CASCADE" })
  @JoinColumn({ name: "productId" })
  product: Product;

  @Column()
  productId: number;
}
