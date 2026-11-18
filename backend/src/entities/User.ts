import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from "typeorm";

@Entity()
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  email: string;

  @Column()
  password: string;

  @Column({ default: "admin" })
  role: string;

  // Sube al cambiar la contraseña: invalida todas las sesiones emitidas antes
  @Column({ type: "int", default: 0 })
  tokenVersion: number;

  @CreateDateColumn()
  createdAt: Date;
}
