import sharp from "sharp";

// Gráficas para el Excel: se dibujan en SVG y se convierten a PNG con sharp
// (Excel no puede mostrar SVG, y así no hace falta ninguna librería de gráficas).

export const COLOR_SALES = "#2a78d6";
export const COLOR_PROFIT = "#eb6834";
const INK = "#0b0b0b";
const MUTED = "#6f6e69";
const GRID = "#ebeae6";
const FONT = "Arial, Helvetica, 'DejaVu Sans', 'Liberation Sans', sans-serif";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export function short(v: number): string {
  const a = Math.abs(v);
  if (a >= 1_000_000) return `${+(v / 1_000_000).toFixed(1)} M`.replace(".", ",");
  if (a >= 1_000) return `${Math.round(v / 1_000)} mil`;
  return String(Math.round(v));
}
const money = (v: number) => "$" + Math.round(v).toLocaleString("es-CO");

function niceStep(raw: number) {
  const pow = Math.pow(10, Math.floor(Math.log10(raw || 1)));
  const f = raw / pow;
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * pow;
}

/** Barra con 4px redondeados en el extremo de datos y base recta */
function bar(x: number, y: number, w: number, h: number, up: boolean, color: string) {
  if (h <= 0 || w <= 0) return "";
  const r = Math.min(4, w / 2, h);
  const d = up
    ? `M${x},${y + h} V${y + r} Q${x},${y} ${x + r},${y} H${x + w - r} Q${x + w},${y} ${x + w},${y + r} V${y + h} Z`
    : `M${x},${y} V${y + h - r} Q${x},${y + h} ${x + r},${y + h} H${x + w - r} Q${x + w},${y + h} ${x + w},${y + h - r} V${y} Z`;
  return `<path d="${d}" fill="${color}"/>`;
}

const toPng = (svg: string) => sharp(Buffer.from(svg), { density: 144 }).png().toBuffer();

/** Barras agrupadas (una o dos series) por periodo, con valores negativos bajo la línea base */
export async function groupedBarChart(opts: {
  title: string;
  labels: string[];
  series: { name: string; color: string; values: number[] }[];
  width?: number;
  height?: number;
}): Promise<Buffer> {
  const W = opts.width ?? 900;
  const H = opts.height ?? 340;
  const padL = 70, padR = 16, padT = 70, padB = 40;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;
  const count = Math.max(1, opts.labels.length);
  const slot = plotW / count;

  const all = opts.series.flatMap((s) => s.values);
  const rawMax = Math.max(0, ...all);
  const rawMin = Math.min(0, ...all);
  const step = niceStep((rawMax - rawMin) / 4 || 1);
  const max = Math.ceil(rawMax / step) * step || step;
  const min = Math.floor(rawMin / step) * step;
  const y = (v: number) => padT + ((max - v) / (max - min)) * plotH;
  const zero = y(0);

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="${FONT}">
<rect width="${W}" height="${H}" fill="#ffffff"/>
<text x="${padL - 50}" y="28" font-size="17" font-weight="bold" fill="${INK}">${esc(opts.title)}</text>`;

  // Leyenda (siempre con 2+ series)
  if (opts.series.length > 1) {
    let lx = padL - 50;
    for (const s of opts.series) {
      svg += `<rect x="${lx}" y="42" width="12" height="12" rx="2" fill="${s.color}"/><text x="${lx + 18}" y="52" font-size="12" fill="${MUTED}">${esc(s.name)}</text>`;
      lx += 30 + s.name.length * 7;
    }
  }

  for (let v = min; v <= max + step / 2; v += step) {
    svg += `<line x1="${padL}" x2="${W - padR}" y1="${y(v)}" y2="${y(v)}" stroke="${v === 0 ? "#9a9993" : GRID}" stroke-width="1"/>`;
    svg += `<text x="${padL - 8}" y="${y(v) + 4}" font-size="11" text-anchor="end" fill="${MUTED}">${short(v)}</text>`;
  }

  const groupW = Math.min(slot * 0.7, 56);
  const gap = opts.series.length > 1 ? 2 : 0;
  const barW = (groupW - gap * (opts.series.length - 1)) / opts.series.length;
  opts.labels.forEach((label, i) => {
    const start = padL + i * slot + (slot - groupW) / 2;
    opts.series.forEach((s, j) => {
      const v = s.values[i] || 0;
      const top = Math.min(y(v), zero);
      svg += bar(start + j * (barW + gap), top, barW, Math.abs(y(v) - zero), v >= 0, s.color);
    });
  });

  const every = Math.max(1, Math.ceil(count / 14));
  opts.labels.forEach((label, i) => {
    if (i % every) return;
    svg += `<text x="${padL + i * slot + slot / 2}" y="${H - 14}" font-size="11" text-anchor="middle" fill="${MUTED}">${esc(label)}</text>`;
  });

  return toPng(svg + "</svg>");
}

/** Ranking en barras horizontales con el valor escrito al lado */
export async function horizontalBarChart(opts: {
  title: string;
  rows: { label: string; value: number; text?: string }[];
  color?: string;
  width?: number;
}): Promise<Buffer> {
  const rows = opts.rows.slice(0, 10);
  const W = opts.width ?? 560;
  const rowH = 30;
  const padT = 50;
  const labelW = 170;
  const valueW = 130;
  const H = padT + Math.max(1, rows.length) * rowH + 16;
  const max = Math.max(1, ...rows.map((r) => r.value));
  const plotW = W - labelW - valueW - 20;
  const color = opts.color ?? COLOR_SALES;

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="${FONT}">
<rect width="${W}" height="${H}" fill="#ffffff"/>
<text x="10" y="28" font-size="16" font-weight="bold" fill="${INK}">${esc(opts.title)}</text>`;
  if (!rows.length) {
    svg += `<text x="10" y="${padT + 18}" font-size="12" fill="${MUTED}">Sin datos en este periodo</text>`;
  }
  rows.forEach((r, i) => {
    const cy = padT + i * rowH;
    const label = r.label.length > 24 ? r.label.slice(0, 23) + "…" : r.label;
    const w = Math.max(2, (Math.max(0, r.value) / max) * plotW);
    svg += `<text x="${labelW}" y="${cy + 18}" font-size="12" text-anchor="end" fill="${INK}" dx="-8">${esc(label)}</text>`;
    svg += `<rect x="${labelW}" y="${cy + 6}" width="${plotW}" height="16" rx="3" fill="#f3f1ec"/>`;
    svg += `<path d="M${labelW},${cy + 6} H${labelW + w - 4} Q${labelW + w},${cy + 6} ${labelW + w},${cy + 10} V${cy + 18} Q${labelW + w},${cy + 22} ${labelW + w - 4},${cy + 22} H${labelW} Z" fill="${color}"/>`;
    svg += `<text x="${labelW + plotW + 8}" y="${cy + 18}" font-size="12" fill="${MUTED}">${esc(r.text ?? money(r.value))}</text>`;
  });
  return toPng(svg + "</svg>");
}
