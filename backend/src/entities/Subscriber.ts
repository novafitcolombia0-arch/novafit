import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from "typeorm";

/** Persona que se suscribió desde el modal de la tienda */
@Entity("subscribers")
export class Subscriber {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  email: string;

  @Column({ nullable: true })
  name: string;

  // Código de bienvenida que se le entregó
  @Column({ nullable: true })
  discountCode: string;

  @CreateDateColumn({ type: "timestamptz" })
  createdAt: Date;
}
