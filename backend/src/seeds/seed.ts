import "reflect-metadata";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { AppDataSource } from "../config/data-source";
import { User, Category, Product, ProductImage, ProductSize } from "../entities";

async function seed() {
  await AppDataSource.initialize();
  console.log("Database connected for seeding");

  const userRepo = AppDataSource.getRepository(User);
  const categoryRepo = AppDataSource.getRepository(Category);
  const productRepo = AppDataSource.getRepository(Product);
  const imageRepo = AppDataSource.getRepository(ProductImage);
  const sizeRepo = AppDataSource.getRepository(ProductSize);

  // La contraseña nunca va en el código: se toma de ADMIN_PASSWORD o se genera una aleatoria
  const adminEmail = (process.env.ADMIN_EMAIL || "admin@nova.com").toLowerCase();
  const existingAdmin = await userRepo.findOne({ where: { email: adminEmail } });
  if (!existingAdmin) {
    const fromEnv = process.env.ADMIN_PASSWORD || "";
    if (fromEnv && fromEnv.length < 12) throw new Error("ADMIN_PASSWORD debe tener al menos 12 caracteres");
    const password = fromEnv || crypto.randomBytes(12).toString("base64url");
    await userRepo.save(
      userRepo.create({ email: adminEmail, password: await bcrypt.hash(password, 12), role: "admin" })
    );
    console.log(fromEnv
      ? `Admin creado: ${adminEmail} (contraseña de ADMIN_PASSWORD)`
      : `Admin creado: ${adminEmail} / contraseña generada: ${password}  ← guárdala y cámbiala en el panel`);
  }

  const categories = [
    { name: "Sets", slug: "sets", description: "Conjuntos coordinados" },
    { name: "Vestidos", slug: "vestidos", description: "Vestidos para toda ocasión" },
    { name: "Bodys", slug: "bodys", description: "Bodies y enterizos" },
    { name: "Blusas", slug: "blusas", description: "Blusas y tops" },
    { name: "Jeans", slug: "jeans", description: "Jeans y pantalones" },
    { name: "Faldas", slug: "faldas", description: "Faldas" },
    { name: "Chaquetas", slug: "chaquetas", description: "Chaquetas y abrigos" },
    { name: "Accesorios", slug: "accesorios", description: "Accesorios y complementos" },
  ];

  for (const cat of categories) {
    const exists = await categoryRepo.findOne({ where: { slug: cat.slug } });
    if (!exists) {
      await categoryRepo.save(categoryRepo.create(cat));
      console.log(`Category created: ${cat.name}`);
    }
  }

  console.log("Seed completed");
  await AppDataSource.destroy();
}

seed().catch((error) => {
  console.error("Seed failed:", error);
  process.exit(1);
});
