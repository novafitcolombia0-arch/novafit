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

  // Baja de los correos (obligatoria en promociones): no se le vuelve a escribir
  @Column({ default: false })
  unsubscribed: boolean;

  @Column({ type: "timestamptz", nullable: true })
  unsubscribedAt: Date | null;

  // Token secreto del enlace "darme de baja" (no se puede adivinar el de otra persona)
  @Column({ type: "varchar", nullable: true, unique: true })
  unsubscribeToken: string | null;

  @CreateDateColumn({ type: "timestamptz" })
  createdAt: Date;
}
