import "reflect-metadata";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import dotenv from "dotenv";
import { AppDataSource } from "./config/data-source";
import authRoutes from "./routes/auth.routes";
import categoryRoutes from "./routes/category.routes";
import productRoutes from "./routes/product.routes";
import settingsRoutes from "./routes/settings.routes";
import imageRoutes from "./routes/image.routes";
import orderRoutes from "./routes/order.routes";
import inventoryRoutes from "./routes/inventory.routes";
import financeRoutes from "./routes/finance.routes";
import discountRoutes from "./routes/discount.routes";
import subscriberRoutes from "./routes/subscriber.routes";
import { errorHandler } from "./middleware/errors";
import { wompiConfig } from "./services/wompi";
import { apiLimiter, hasBearer, jwtSecret } from "./config/security";

dotenv.config();
jwtSecret(); // falla al arrancar si JWT_SECRET falta o es débil

const app = express();
// Solo se confía en el proxy de Railway (1 salto): así req.ip es la IP real y no se puede falsear
// con una cabecera X-Forwarded-For inventada (importante para los límites de intentos)
app.set("trust proxy", 1);
const PORT = process.env.PORT || 3000;

// Cabeceras de seguridad. Las imágenes de /api/images las usa la tienda desde otro dominio
app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
app.use(cors());
app.use("/api", apiLimiter);
// Cuerpos grandes solo para el panel (subida de fotos); las rutas públicas aceptan muy poco
const largeBody = express.json({ limit: "15mb" });
const smallBody = express.json({ limit: "100kb" });
app.use((req, res, next) => (hasBearer(req) ? largeBody : smallBody)(req, res, next));

app.use("/api/auth", authRoutes);
app.use("/api/categories", categoryRoutes);
app.use("/api/products", productRoutes);
app.use("/api/settings", settingsRoutes);
app.use("/api/images", imageRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/inventory", inventoryRoutes);
app.use("/api/finance", financeRoutes);
app.use("/api/discounts", discountRoutes);
app.use("/api/subscribers", subscriberRoutes);

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use(errorHandler);

AppDataSource.initialize()
  .then(() => {
    console.log("Database connected");
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
      const wompi = wompiConfig();
      if (!wompi.publicKey) console.log("Wompi: sin llaves, pagos en línea desactivados");
      else console.log(`Wompi: ${wompi.publicKey.startsWith("pub_prod_") ? "PRODUCCIÓN" : "Sandbox"}`);
      [...wompi.problems, ...wompi.warnings].forEach((p) => console.warn(`Wompi: ${p}`));
    });
  })
  .catch((error) => {
    console.error("Database connection failed:", error);
    process.exit(1);
  });
