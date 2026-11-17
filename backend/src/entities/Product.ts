import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from "typeorm";
import { Category } from "./Category";
import { ProductImage } from "./ProductImage";
import { ProductSize } from "./ProductSize";

@Entity()
export class Product {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @Column({ unique: true })
  slug: string;

  @Column({ type: "text", nullable: true })
  description: string;

  @Column("decimal", { precision: 10, scale: 2 })
  price: number;

  // Lo que cuesta la prenda (producción/compra). select: false → nunca sale en la tienda pública
  @Column("decimal", { precision: 10, scale: 2, nullable: true, select: false })
  cost: number | null;

  @Column({ default: true })
  isActive: boolean;

  @ManyToOne(() => Category, (category) => category.products, { eager: true })
  @JoinColumn({ name: "categoryId" })
  category: Category;

  @Column()
  categoryId: number;

  @OneToMany(() => ProductImage, (image) => image.product, {
    eager: true,
    cascade: true,
  })
  images: ProductImage[];

  @OneToMany(() => ProductSize, (size) => size.product, {
    eager: true,
    cascade: true,
  })
  sizes: ProductSize[];
}
