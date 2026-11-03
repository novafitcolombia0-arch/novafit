import { Entity, PrimaryGeneratedColumn, Column } from "typeorm";

@Entity()
export class SiteSetting {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  key: string;

  @Column({ type: "text", nullable: true })
  value: string;
}
