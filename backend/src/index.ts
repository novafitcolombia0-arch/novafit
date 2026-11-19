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
import campaignRoutes from "./routes/campaign.routes";
import { errorHandler } from "./middleware/errors";
import { wompiConfig } from "./services/wompi";
import { apiLimiter, corsOrigin, hasValidBearer, jwtSecret } from "./config/security";
import { startReservationSweeper } from "./services/orders";

dotenv.config();
jwtSecret(); // falla al arrancar si JWT_SECRET falta o es débil

const app = express();
// Railway pasa por 2 proxies (entrada + interno) y reescribe X-Forwarded-For con la IP real del
// visitante; confiar en esos 2 saltos hace que req.ip sea la IP real y no se pueda falsear con una
// cabecera inventada (comprobado en QA). Importante para los límites de intentos.
app.set("trust proxy", parseInt(process.env.TRUST_PROXY_HOPS || "2", 10));
const PORT = process.env.PORT || 3000;

// Cabeceras de seguridad. Las imágenes de /api/images las usa la tienda desde otro dominio
app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
app.use(cors({ origin: corsOrigin() }));
app.use("/api", apiLimiter);
// Cuerpos grandes solo para el panel (subida de fotos) con una sesión firmada de verdad;
// el resto (incluido quien mande un "Bearer" inventado) acepta muy poco
const largeBody = express.json({ limit: "15mb" });
const smallBody = express.json({ limit: "100kb" });
app.use((req, res, next) => (hasValidBearer(req) ? largeBody : smallBody)(req, res, next));

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
app.use("/api/campaigns", campaignRoutes);

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use(errorHandler);

AppDataSource.initialize()
  .then(() => {
    console.log("Database connected");
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
      startReservationSweeper();
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
