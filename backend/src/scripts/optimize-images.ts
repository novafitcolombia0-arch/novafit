import "reflect-metadata";
import sharp from "sharp";
import { AppDataSource } from "../config/data-source";

// Comprime las imágenes ya guardadas (fotos de móvil de varios MB).
// Antes copia las tablas a backup_<fecha>_*; se puede ejecutar varias veces:
// las imágenes que ya pesan poco se dejan como están.

const SKIP_BELOW = 400 * 1024;

async function compress(dataUrl: unknown, maxSize: number): Promise<string | null> {
  if (typeof dataUrl !== "string") return null;
  const match = dataUrl.match(/^data:[^;,]*;base64,(.*)$/s);
  if (!match) return null;
  const input = Buffer.from(match[1], "base64");
  if (input.length <= SKIP_BELOW) return null;
  // Ya optimizada (dimensiones finales y peso razonable): no recomprimir para no perder calidad
  const { width = 0, height = 0 } = await sharp(input).metadata();
  if (Math.max(width, height) <= maxSize && input.length <= 1024 * 1024) return null;
  const output = await sharp(input)
    .rotate() // respeta la orientación EXIF de las fotos de móvil
    .resize({ width: maxSize, height: maxSize, fit: "inside", withoutEnlargement: true })
    .flatten({ background: "#ffffff" })
    .jpeg({ quality: 80, mozjpeg: true })
    .toBuffer();
  if (output.length >= input.length) return null;
  return `data:image/jpeg;base64,${output.toString("base64")}`;
}

const kb = (dataUrl: string) => Math.round((dataUrl.length * 3) / 4 / 1024);

async function main() {
  await AppDataSource.initialize();
  const q = (sql: string, params?: unknown[]) => AppDataSource.query(sql, params);

  const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  for (const table of ["product_image", "category", "site_setting"]) {
    await q(`CREATE TABLE IF NOT EXISTS "backup_${stamp}_${table}" AS TABLE "${table}"`);
  }
  console.log(`Copia de seguridad: backup_${stamp}_product_image / _category / _site_setting`);

  let before = 0;
  let after = 0;
  const track = (oldData: string, newData: string) => {
    before += kb(oldData);
    after += kb(newData);
  };

  const imageIds: { id: number }[] = await q(`SELECT id FROM product_image ORDER BY id`);
  for (const { id } of imageIds) {
    const [row] = await q(`SELECT "imageData" FROM product_image WHERE id = $1`, [id]);
    const compressed = await compress(row?.imageData, 1600);
    if (!compressed) continue;
    await q(`UPDATE product_image SET "imageData" = $1, "mimeType" = 'image/jpeg' WHERE id = $2`, [compressed, id]);
    track(row.imageData, compressed);
  }

  const categories: { id: number; image: string }[] = await q(`SELECT id, image FROM category`);
  for (const category of categories) {
    const compressed = await compress(category.image, 1000);
    if (!compressed) continue;
    await q(`UPDATE category SET image = $1 WHERE id = $2`, [compressed, category.id]);
    track(category.image, compressed);
  }

  const [hero] = await q(`SELECT value FROM site_setting WHERE key = 'heroImages'`);
  if (hero?.value) {
    const images: string[] = JSON.parse(hero.value);
    const result: string[] = [];
    for (const image of images) {
      const compressed = await compress(image, 1920);
      if (compressed) track(image, compressed);
      result.push(compressed ?? image);
    }
    await q(`UPDATE site_setting SET value = $1 WHERE key = 'heroImages'`, [JSON.stringify(result)]);
  }

  console.log(`Imágenes optimizadas: ${Math.round(before / 1024)} MB → ${Math.round(after / 1024)} MB`);
  await AppDataSource.destroy();
}

main().catch((error) => {
  console.error("Optimización fallida:", error);
  process.exit(1);
});
