import "reflect-metadata";
import bcrypt from "bcryptjs";
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

  const existingAdmin = await userRepo.findOne({ where: { email: "admin@nova.com" } });
  if (!existingAdmin) {
    const hashedPassword = await bcrypt.hash("admin123", 10);
    await userRepo.save(
      userRepo.create({
        email: "admin@nova.com",
        password: hashedPassword,
        role: "admin",
      })
    );
    console.log("Admin user created: admin@nova.com / admin123");
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
