import { Request, Response } from "express";
import crypto from "crypto";
import { createRouter } from "../middleware/errors";
import { AppDataSource } from "../config/data-source";
import { Category, ProductImage, SiteSetting } from "../entities";

// Las imágenes se guardan en la base como data URL (base64). Enviarlas dentro de
// cada listado hacía respuestas de decenas de MB; ahora los listados llevan solo
// la URL de cada imagen y aquí se sirven por separado, con caché en el navegador.

const router = createRouter();

export const isDataUrl = (value: unknown): value is `data:${string}` =>
  typeof value === "string" && value.startsWith("data:");

const version = (data: string) => crypto.createHash("md5").update(data).digest("hex").slice(0, 10);

const baseUrl = (req: Request) => `${req.protocol}://${req.get("host")}/api/images`;

export const productImageUrl = (req: Request, id: number) => `${baseUrl(req)}/product/${id}`;

export const categoryImageUrl = (req: Request, category: Category) =>
  `${baseUrl(req)}/category/${category.id}?v=${version(category.image)}`;

export const heroImageUrl = (req: Request, index: number, data: string) =>
  `${baseUrl(req)}/hero/${index}?v=${version(data)}`;

// Sustituye los datos de imagen por URLs antes de responder
export function withImageUrls<T extends { images?: { id: number; imageData?: string }[] }>(req: Request, product: T): T {
  product.images?.forEach((img) => (img.imageData = productImageUrl(req, img.id)));
  return product;
}

export function withCategoryImageUrl<T extends Category | null | undefined>(req: Request, category: T): T {
  if (category?.image) category.image = isDataUrl(category.image) ? categoryImageUrl(req, category) : category.image;
  return category;
}

export function heroImagesWithUrls(req: Request, value: string): string {
  try {
    const images: string[] = JSON.parse(value);
    return JSON.stringify(images.map((img, i) => (isDataUrl(img) ? heroImageUrl(req, i, img) : img)));
  } catch {
    return value;
  }
}

function sendDataUrl(res: Response, data: string | null | undefined, immutable: boolean) {
  const match = data?.match(/^data:([^;,]+)?(;base64)?,(.*)$/s);
  if (!match) return res.status(404).json({ message: "Imagen no encontrada" });
  const [, mime = "application/octet-stream", base64, payload] = match;
  const body = base64 ? Buffer.from(payload, "base64") : Buffer.from(decodeURIComponent(payload));
  res.set("Content-Type", mime);
  res.set("Cache-Control", immutable ? "public, max-age=31536000, immutable" : "public, max-age=300");
  res.send(body);
}

router.get("/product/:id", async (req: Request, res: Response) => {
  const image = await AppDataSource.getRepository(ProductImage)
    .createQueryBuilder("image")
    .addSelect("image.imageData")
    .where("image.id = :id", { id: parseInt(req.params.id as string) })
    .getOne();
  // Las imágenes de producto nunca cambian: al editar un producto se crean filas nuevas
  sendDataUrl(res, image?.imageData, true);
});

router.get("/category/:id", async (req: Request, res: Response) => {
  const category = await AppDataSource.getRepository(Category).findOne({
    where: { id: parseInt(req.params.id as string) },
  });
  sendDataUrl(res, category?.image, !!req.query.v);
});

router.get("/hero/:index", async (req: Request, res: Response) => {
  const setting = await AppDataSource.getRepository(SiteSetting).findOne({ where: { key: "heroImages" } });
  let images: string[] = [];
  try { images = JSON.parse(setting?.value || "[]"); } catch {}
  sendDataUrl(res, images[parseInt(req.params.index as string)], !!req.query.v);
});

export default router;
