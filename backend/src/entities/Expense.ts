import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from "typeorm";

// Gastos del negocio que no son el costo de las prendas:
// publicidad (Meta Ads), envíos, empaques, plataformas, arriendo, etc.
export const EXPENSE_CATEGORIES = [
  "PUBLICIDAD",
  "ENVIOS",
  "EMPAQUE",
  "PLATAFORMAS",
  "NOMINA",
  "ARRIENDO",
  "SERVICIOS",
  "OTROS",
] as const;
export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

@Entity({ name: "expenses" })
@Index(["date"])
export class Expense {
  @PrimaryGeneratedColumn()
  id: number;

  // Fecha del gasto (YYYY-MM-DD, hora de Colombia)
  @Column({ type: "date" })
  date: string;

  @Column({ type: "varchar" })
  category: ExpenseCategory;

  @Column()
  description: string;

  // Pesos COP
  @Column({ type: "int" })
  amount: number;

  @CreateDateColumn({ type: "timestamptz" })
  createdAt: Date;
}
