// Formatos y etiquetas compartidos por las pantallas de Finanzas

export const money = (v: number | null | undefined) =>
  v === null || v === undefined ? '—' : '$' + Math.round(v).toLocaleString('es-CO');

export const pct = (v: number | null | undefined) =>
  v === null || v === undefined || !Number.isFinite(v) ? '—' : (v * 100).toFixed(1).replace('.', ',') + '%';

export const MONTHS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
export const MONTHS_SHORT = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

export const CHANNEL_LABELS: Record<string, string> = { WEB: 'Tienda web', MANUAL: 'Venta directa' };

export const PAYMENT_LABELS: Record<string, string> = {
  EFECTIVO: 'Efectivo',
  TRANSFERENCIA: 'Transferencia',
  NEQUI: 'Nequi',
  DAVIPLATA: 'Daviplata',
  DATAFONO: 'Datáfono',
  OTRO: 'Otro',
  CARD: 'Tarjeta (Wompi)',
  PSE: 'PSE (Wompi)',
  BANCOLOMBIA_TRANSFER: 'Botón Bancolombia',
  BANCOLOMBIA_QR: 'QR Bancolombia',
  'SIN DATO': 'Sin dato',
};

export const EXPENSE_LABELS: Record<string, string> = {
  PUBLICIDAD: 'Publicidad (Meta Ads, etc.)',
  ENVIOS: 'Envíos',
  EMPAQUE: 'Empaque',
  PLATAFORMAS: 'Plataformas / software',
  NOMINA: 'Nómina / pagos',
  ARRIENDO: 'Arriendo',
  SERVICIOS: 'Servicios',
  OTROS: 'Otros',
};

export const label = (map: Record<string, string>, key: string) => map[key] || key;

// Colores de las series (paleta validada para daltonismo y contraste)
export const COLOR_SALES = '#2a78d6';
export const COLOR_PROFIT = '#eb6834';

/** "2026-11-05" → "5 nov" · "2026-11" → "Nov 26" */
export function periodLabel(period: string, long = false): string {
  const [y, m, d] = period.split('-').map(Number);
  if (d) return long ? `${d} de ${MONTHS[m - 1].toLowerCase()} ${y}` : `${d} ${MONTHS_SHORT[m - 1].toLowerCase()}`;
  return long ? `${MONTHS[m - 1]} ${y}` : `${MONTHS_SHORT[m - 1]} ${String(y).slice(2)}`;
}
