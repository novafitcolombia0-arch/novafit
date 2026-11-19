import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from "typeorm";

/** Promoción enviada por correo a los suscriptores (historial del panel) */
@Entity("email_campaigns")
export class EmailCampaign {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  subject: string;

  @Column()
  title: string;

  @Column({ type: "text" })
  message: string;

  @Column({ nullable: true })
  discountCode: string;

  @Column({ nullable: true })
  buttonText: string;

  @Column({ nullable: true })
  buttonUrl: string;

  // A quién se envió: los suscriptores activos o una lista de correos escrita a mano
  @Column({ default: "SUBSCRIBERS" })
  audience: "SUBSCRIBERS" | "MANUAL";

  // SENDING mientras se envía; SENT al terminar
  @Column({ default: "SENDING" })
  status: "SENDING" | "SENT";

  @Column({ type: "int", default: 0 })
  recipients: number;

  @Column({ type: "int", default: 0 })
  sent: number;

  @Column({ type: "int", default: 0 })
  failed: number;

  @CreateDateColumn({ type: "timestamptz" })
  createdAt: Date;

  @Column({ type: "timestamptz", nullable: true })
  finishedAt: Date | null;
}
