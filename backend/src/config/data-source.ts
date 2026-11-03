import { DataSource } from "typeorm";
import dotenv from "dotenv";
import { Category, Product, ProductImage, ProductSize, User, SiteSetting } from "../entities";
dotenv.config();

// En la nube (Neon, Render, Railway...) se usa DATABASE_URL con SSL;
// en local, las variables DB_* sueltas.
const connection = process.env.DATABASE_URL
  ? { url: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } }
  : {
      host: process.env.DB_HOST || "localhost",
      port: parseInt(process.env.DB_PORT || "5432"),
      username: process.env.DB_USERNAME || "postgres",
      password: process.env.DB_PASSWORD || "postgres",
      database: process.env.DB_NAME || "nova_db",
    };

export const AppDataSource = new DataSource({
  type: "postgres",
  ...connection,
  synchronize: true,
  logging: false,
  entities: [Category, Product, ProductImage, ProductSize, User, SiteSetting],
});
