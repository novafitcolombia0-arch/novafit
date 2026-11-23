import { Component, OnInit } from '@angular/core';
import { CurrencyPipe, DatePipe, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ApiService } from '../../../services/api.service';
import { InventoryMovement, InventoryProduct, InventorySize } from '../../../models/types';

const LOW_STOCK_KEY = 'nova_low_stock';

const MOVEMENT_LABELS: Record<string, string> = {
  ENTRADA: 'Entrada',
  SALIDA: 'Salida',
  AJUSTE: 'Ajuste por conteo',
  VENTA_WEB: 'Venta web',
  LIBERACION: 'Pedido no pagado',
  CREACION: 'Stock inicial',
  ELIMINACION: 'Talla eliminada',
  VENTA_MANUAL: 'Venta directa',
  ANULACION: 'Venta anulada',
};

interface Selection {
  product: InventoryProduct;
  size: InventorySize;
}

@Component({
    selector: 'app-admin-inventory',
    imports: [CurrencyPipe, DatePipe, DecimalPipe, FormsModule, RouterLink],
    template: `
    <div class="w-full">
      <div class="flex flex-wrap items-end justify-between gap-4 mb-6">
        <div>
          <h1 class="font-display text-3xl font-bold text-nova-dark">Inventario</h1>
        </div>
        <div class="flex gap-2 text-sm">
          <button (click)="tab = 'stock'" [class.bg-nova-dark]="tab === 'stock'" [class.text-white]="tab === 'stock'"
                  class="px-4 py-2 rounded border border-nova-dark">Existencias</button>
          <button (click)="tab = 'movements'; loadMovements()" [class.bg-nova-dark]="tab === 'movements'" [class.text-white]="tab === 'movements'"
                  class="px-4 py-2 rounded border border-nova-dark">Movimientos</button>
        </div>
      </div>

      @if (error) { <div class="bg-red-50 text-red-600 p-3 rounded mb-4 text-sm">{{ error }}</div> }

      @if (tab === 'stock') {
        <!-- Resumen -->
        <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div class="bg-white border border-nova-blush rounded-lg p-4">
            <p class="text-xs text-nova-gray uppercase tracking-wider">Unidades en stock</p>
            <p class="text-2xl font-bold text-nova-dark">{{ totals.units | number }}</p>
          </div>
          <div class="bg-white border border-nova-blush rounded-lg p-4">
            <p class="text-xs text-nova-gray uppercase tracking-wider">Valor a precio de venta</p>
            <p class="text-2xl font-bold text-nova-dark">{{ totals.value | currency:'COP':'$':'1.0-0' }}</p>
          </div>
          <button (click)="filter = filter === 'low' ? 'all' : 'low'" class="text-left bg-white border rounded-lg p-4"
                  [class.border-yellow-400]="filter === 'low'" [class.border-nova-blush]="filter !== 'low'">
            <p class="text-xs text-nova-gray uppercase tracking-wider">Tallas con stock bajo</p>
            <p class="text-2xl font-bold text-yellow-600">{{ totals.low }}</p>
          </button>
          <button (click)="filter = filter === 'out' ? 'all' : 'out'" class="text-left bg-white border rounded-lg p-4"
                  [class.border-red-400]="filter === 'out'" [class.border-nova-blush]="filter !== 'out'">
            <p class="text-xs text-nova-gray uppercase tracking-wider">Tallas agotadas</p>
            <p class="text-2xl font-bold text-red-600">{{ totals.out }}</p>
          </button>
        </div>

        <!-- Filtros -->
        <div class="flex flex-wrap items-center gap-3 mb-4 text-sm">
          <input [(ngModel)]="search" placeholder="Buscar prenda..." class="border border-nova-blush rounded px-3 py-2 w-full md:w-72 bg-white">
          <select [(ngModel)]="filter" class="border border-nova-blush rounded px-3 py-2 bg-white">
            <option value="all">Todas</option>
            <option value="low">Stock bajo</option>
            <option value="out">Agotadas</option>
          </select>
          <label class="flex items-center gap-2 text-nova-gray">
            Stock bajo si quedan ≤
            <input type="number" min="0" [(ngModel)]="lowStock" (ngModelChange)="saveLowStock()" class="w-16 border border-nova-blush rounded px-2 py-1">
          </label>
          <button (click)="exportCsv()" class="ml-auto underline text-nova-dark hover:text-nova-rose">Descargar CSV</button>
        </div>

        <p class="text-xs text-nova-gray mb-3">Toca una talla para <strong>sumar</strong> (llegó mercancía), <strong>restar</strong> (venta en persona, daño, regalo...) o <strong>contar</strong> (fijar el número exacto). "Apartadas" son prendas en pedidos web que aún no se han pagado.</p>

        <!-- Tabla -->
        <div class="bg-white border border-nova-blush rounded-lg overflow-x-auto">
          <table class="w-full text-sm">
            <thead class="bg-nova-cream text-nova-gray">
              <tr>
                <th class="text-left px-4 py-3 font-medium">Prenda</th>
                <th class="text-left px-4 py-3 font-medium">Tallas (stock)</th>
                <th class="text-right px-4 py-3 font-medium">Total</th>
                <th class="text-right px-4 py-3 font-medium">Vendidas web 30 días</th>
              </tr>
            </thead>
            <tbody>
              @for (p of visibleProducts(); track p.id) {
                <tr class="border-t border-nova-pink align-top">
                  <td class="px-4 py-3">
                    <div class="flex items-center gap-3">
                      <div class="w-10 h-12 bg-nova-pink rounded overflow-hidden shrink-0">
                        @if (p.image) { <img [src]="p.image" class="w-full h-full object-cover" loading="lazy"> }
                      </div>
                      <div>
                        <p class="font-medium text-nova-dark">{{ p.name }}</p>
                        <p class="text-xs text-nova-gray">{{ p.category }} · {{ p.price | currency:'COP':'$':'1.0-0' }}
                          @if (!p.isActive) { <span class="text-red-600">· inactivo</span> }
                        </p>
                      </div>
                    </div>
                  </td>
                  <td class="px-4 py-3">
                    @for (g of groups(p); track g.color) {
                      <div class="flex flex-wrap items-center gap-2 mb-1.5">
                        @if (g.color) {
                          <span class="w-20 text-xs text-nova-gray flex items-center gap-1"><span class="w-3 h-3 rounded-full border border-nova-blush shrink-0" [style.background]="g.hex"></span>{{ g.color }}</span>
                        }
                        @for (s of g.sizes; track s.size) {
                          <button (click)="select(p, s)"
                                  class="border rounded px-2 py-1 text-left min-w-[56px] transition hover:shadow"
                                  [class]="chipClass(s)"
                                  [class.ring-2]="isSelected(p, s)" [class.ring-nova-dark]="isSelected(p, s)">
                            <span class="block text-[11px] text-nova-gray">{{ s.size }}</span>
                            <span class="block font-semibold">{{ s.stock }}</span>
                            @if (s.reserved > 0) { <span class="block text-[10px] text-nova-gray">{{ s.reserved }} apart.</span> }
                          </button>
                        }
                      </div>
                    } @empty {
                      <span class="text-xs text-nova-gray">Sin tallas</span>
                    }

                    @if (selected && selected.product.id === p.id) {
                      <div class="mt-3 border border-nova-blush rounded-lg p-3 bg-nova-cream max-w-md">
                        <p class="font-medium text-nova-dark mb-2">{{ selected.size.color ? selected.size.color + ' · ' : '' }}{{ selected.size.size === 'Única' ? 'Talla única' : 'Talla ' + selected.size.size }} · hay {{ selected.size.stock }}</p>
                        <div class="grid grid-cols-3 gap-1 mb-2 text-xs">
                          <button (click)="setType('ENTRADA')" class="border rounded px-2 py-1.5" [class]="typeClass('ENTRADA')">+ Sumar</button>
                          <button (click)="setType('SALIDA')" class="border rounded px-2 py-1.5" [class]="typeClass('SALIDA')">− Restar</button>
                          <button (click)="setType('AJUSTE')" class="border rounded px-2 py-1.5" [class]="typeClass('AJUSTE')">= Contar</button>
                        </div>
                        <div class="flex flex-wrap items-center gap-2 mb-2">
                          <input type="number" [(ngModel)]="adjust.quantity" (ngModelChange)="onQuantity($event)" class="w-24 border border-nova-blush rounded px-2 py-1.5"
                                 [placeholder]="adjust.type === 'AJUSTE' ? 'Hay exactamente' : 'Cantidad'">
                          <span class="text-xs text-nova-gray">{{ adjust.type === 'ENTRADA' ? 'unidades que llegaron' : adjust.type === 'SALIDA' ? 'unidades que salen' : 'unidades contadas en total' }}</span>
                        </div>
                        <input [(ngModel)]="adjust.note" placeholder="Nota (opcional): proveedor, motivo..." class="w-full border border-nova-blush rounded px-2 py-1.5 mb-2">
                        @if (preview() !== null && preview()! >= 0) {
                          <p class="text-xs text-nova-gray mb-2">Quedarán <strong class="text-nova-dark">{{ preview() }}</strong> unidades.</p>
                        } @else if (preview() !== null) {
                          <p class="text-xs text-red-600 mb-2">No puedes restar {{ adjust.quantity }}: solo hay {{ selected.size.stock }}.</p>
                        }
                        <div class="flex gap-2">
                          <button (click)="saveAdjust()" [disabled]="saving || preview() === null || preview()! < 0"
                                  class="bg-nova-dark text-white px-4 py-1.5 rounded disabled:opacity-50">{{ saving ? 'Guardando...' : 'Guardar' }}</button>
                          <button (click)="selected = null" class="px-3 py-1.5 text-nova-gray">Cancelar</button>
                          <button (click)="showHistory(p)" class="ml-auto text-xs underline text-nova-gray">Ver historial</button>
                        </div>
                      </div>
                    }
                  </td>
                  <td class="px-4 py-3 text-right font-medium text-nova-dark">{{ totalStock(p) }}</td>
                  <td class="px-4 py-3 text-right text-nova-gray">{{ totalSold(p) }}</td>
                </tr>
              } @empty {
                <tr><td colspan="4" class="px-4 py-12 text-center text-nova-gray">{{ loading ? 'Cargando...' : 'No hay prendas con ese filtro' }}</td></tr>
              }
            </tbody>
          </table>
        </div>
      }

      @if (tab === 'movements') {
        <div class="flex flex-wrap items-center gap-3 mb-4 text-sm">
          <select [(ngModel)]="movementProductId" (ngModelChange)="loadMovements()" class="border border-nova-blush rounded px-3 py-2 bg-white">
            <option [ngValue]="null">Todas las prendas</option>
            @for (p of products; track p.id) { <option [ngValue]="p.id">{{ p.name }}</option> }
          </select>
          <select [(ngModel)]="movementType" (ngModelChange)="loadMovements()" class="border border-nova-blush rounded px-3 py-2 bg-white">
            <option value="">Todos los tipos</option>
            @for (t of movementTypes; track t) { <option [value]="t">{{ movementLabel(t) }}</option> }
          </select>
        </div>
        <div class="bg-white border border-nova-blush rounded-lg overflow-x-auto">
          <table class="w-full text-sm">
            <thead class="bg-nova-cream text-nova-gray">
              <tr>
                <th class="text-left px-4 py-3 font-medium">Fecha</th>
                <th class="text-left px-4 py-3 font-medium">Prenda</th>
                <th class="text-left px-4 py-3 font-medium">Color / talla</th>
                <th class="text-left px-4 py-3 font-medium">Tipo</th>
                <th class="text-right px-4 py-3 font-medium">Cambio</th>
                <th class="text-right px-4 py-3 font-medium">Quedó</th>
                <th class="text-left px-4 py-3 font-medium">Detalle</th>
              </tr>
            </thead>
            <tbody>
              @for (m of movements; track m.id) {
                <tr class="border-t border-nova-pink">
                  <td class="px-4 py-2 text-nova-gray whitespace-nowrap">{{ m.createdAt | date:'dd/MM/yy HH:mm' }}</td>
                  <td class="px-4 py-2 text-nova-dark">{{ m.productName }}</td>
                  <td class="px-4 py-2 whitespace-nowrap">{{ m.color ? m.color + ' · ' : '' }}{{ m.size }}</td>
                  <td class="px-4 py-2">{{ movementLabel(m.type) }}</td>
                  <td class="px-4 py-2 text-right font-medium" [class.text-green-700]="m.quantity > 0" [class.text-red-600]="m.quantity < 0">
                    {{ m.quantity > 0 ? '+' : '' }}{{ m.quantity }}
                  </td>
                  <td class="px-4 py-2 text-right">{{ m.stockAfter ?? '—' }}</td>
                  <td class="px-4 py-2 text-xs text-nova-gray">{{ m.reference }} {{ m.note }}</td>
                </tr>
              } @empty {
                <tr><td colspan="7" class="px-4 py-12 text-center text-nova-gray">{{ loading ? 'Cargando...' : 'Sin movimientos todavía' }}</td></tr>
              }
            </tbody>
          </table>
        </div>
      }
    </div>
  `
})
export class AdminInventoryComponent implements OnInit {
  tab: 'stock' | 'movements' = 'stock';
  products: InventoryProduct[] = [];
  movements: InventoryMovement[] = [];
  movementTypes = Object.keys(MOVEMENT_LABELS);
  movementProductId: number | null = null;
  movementType = '';

  search = '';
  filter: 'all' | 'low' | 'out' = 'all';
  lowStock = this.readLowStock();
  totals = { units: 0, value: 0, low: 0, out: 0 };

  selected: Selection | null = null;
  adjust = { type: 'ENTRADA' as 'ENTRADA' | 'SALIDA' | 'AJUSTE', quantity: null as number | null, note: '' };
  saving = false;
  loading = false;
  error = '';

  constructor(private api: ApiService) {}

  ngOnInit() { this.load(); }

  load() {
    this.loading = true;
    this.api.getInventory().subscribe({
      next: products => {
        this.products = products;
        this.computeTotals();
        this.loading = false;
        if (this.selected) {
          const p = products.find(x => x.id === this.selected!.product.id);
          const s = p?.sizes.find(x => x.size === this.selected!.size.size && x.color === this.selected!.size.color);
          this.selected = p && s ? { product: p, size: s } : null;
        }
      },
      error: () => { this.error = 'No se pudo cargar el inventario'; this.loading = false; },
    });
  }

  loadMovements() {
    this.loading = true;
    this.api.getInventoryMovements(this.movementProductId ?? undefined, this.movementType || undefined).subscribe({
      next: m => { this.movements = m; this.loading = false; },
      error: () => { this.error = 'No se pudo cargar el historial'; this.loading = false; },
    });
  }

  computeTotals() {
    const t = { units: 0, value: 0, low: 0, out: 0 };
    for (const p of this.products) {
      for (const s of p.sizes) {
        t.units += s.stock;
        t.value += s.stock * p.price;
        if (!p.isActive) continue;
        if (s.stock <= 0) t.out++;
        else if (s.stock <= this.lowStock) t.low++;
      }
    }
    this.totals = t;
  }

  visibleProducts(): InventoryProduct[] {
    const q = this.search.trim().toLowerCase();
    return this.products.filter(p => {
      if (q && !p.name.toLowerCase().includes(q) && !p.category.toLowerCase().includes(q)) return false;
      if (this.filter === 'low') return p.isActive && p.sizes.some(s => s.stock > 0 && s.stock <= this.lowStock);
      if (this.filter === 'out') return p.isActive && p.sizes.some(s => s.stock <= 0);
      return true;
    });
  }

  chipClass(s: InventorySize): string {
    if (s.stock <= 0) return 'border-red-300 bg-red-50 text-red-700';
    if (s.stock <= this.lowStock) return 'border-yellow-300 bg-yellow-50 text-yellow-800';
    return 'border-nova-blush bg-white text-nova-dark';
  }

  totalStock(p: InventoryProduct) { return p.sizes.reduce((n, s) => n + s.stock, 0); }
  totalSold(p: InventoryProduct) { return p.sizes.reduce((n, s) => n + s.sold30d, 0); }

  isSelected(p: InventoryProduct, s: InventorySize) {
    return this.selected?.product.id === p.id && this.selected?.size.size === s.size && this.selected?.size.color === s.color;
  }

  /** Tallas agrupadas por color (un solo grupo sin nombre si la prenda no maneja colores) */
  groups(p: InventoryProduct): { color: string; hex: string; sizes: InventorySize[] }[] {
    const groups: { color: string; hex: string; sizes: InventorySize[] }[] = [];
    for (const s of p.sizes) {
      let g = groups.find(x => x.color === s.color);
      if (!g) groups.push(g = { color: s.color, hex: p.colors?.find(c => c.name === s.color)?.hex || '#ccc', sizes: [] });
      g.sizes.push(s);
    }
    return groups;
  }

  setType(type: 'ENTRADA' | 'SALIDA' | 'AJUSTE') {
    this.adjust.type = type;
  }

  typeClass(type: 'ENTRADA' | 'SALIDA' | 'AJUSTE'): string {
    const color = { ENTRADA: ['border-green-700', 'bg-green-700', 'text-green-800'], SALIDA: ['border-red-600', 'bg-red-600', 'text-red-700'], AJUSTE: ['border-nova-dark', 'bg-nova-dark', 'text-nova-dark'] }[type];
    return this.adjust.type === type ? `${color[0]} ${color[1]} text-white` : `${color[0]} bg-white ${color[2]}`;
  }

  /** Si escriben un número negativo en "Sumar", se entiende que quieren restar */
  onQuantity(value: number | null) {
    if (value !== null && value < 0 && this.adjust.type !== 'AJUSTE') {
      this.adjust.type = 'SALIDA';
      setTimeout(() => (this.adjust.quantity = Math.abs(value)));
    }
  }

  select(product: InventoryProduct, size: InventorySize) {
    this.selected = this.isSelected(product, size) ? null : { product, size };
    this.adjust = { type: 'ENTRADA', quantity: null, note: '' };
  }

  preview(): number | null {
    if (!this.selected || this.adjust.quantity === null || this.adjust.quantity === undefined) return null;
    const qty = Math.trunc(Number(this.adjust.quantity));
    if (!Number.isFinite(qty) || qty < 0) return null;
    if (this.adjust.type !== 'AJUSTE' && qty === 0) return null;
    const stock = this.selected.size.stock;
    if (this.adjust.type === 'ENTRADA') return stock + qty;
    if (this.adjust.type === 'SALIDA') return stock - qty;
    return qty;
  }

  saveAdjust() {
    if (!this.selected || this.preview() === null) return;
    this.saving = true;
    this.error = '';
    this.api.adjustInventory({
      productId: this.selected.product.id,
      color: this.selected.size.color,
      size: this.selected.size.size,
      type: this.adjust.type,
      quantity: Math.trunc(Number(this.adjust.quantity)),
      note: this.adjust.note,
    }).subscribe({
      next: res => {
        this.saving = false;
        this.selected!.size.stock = res.stock;
        this.computeTotals();
        this.adjust = { type: this.adjust.type, quantity: null, note: '' };
      },
      error: err => {
        this.saving = false;
        this.error = err?.error?.message || 'No se pudo guardar el movimiento';
      },
    });
  }

  showHistory(p: InventoryProduct) {
    this.movementProductId = p.id;
    this.movementType = '';
    this.tab = 'movements';
    this.loadMovements();
  }

  movementLabel(type: string) { return MOVEMENT_LABELS[type] || type; }

  saveLowStock() {
    this.lowStock = Math.max(0, Math.trunc(Number(this.lowStock) || 0));
    try { localStorage.setItem(LOW_STOCK_KEY, String(this.lowStock)); } catch {}
    this.computeTotals();
  }

  private readLowStock(): number {
    try {
      const v = parseInt(localStorage.getItem(LOW_STOCK_KEY) || '', 10);
      return Number.isFinite(v) && v >= 0 ? v : 3;
    } catch {
      return 3;
    }
  }

  exportCsv() {
    const rows = [['Prenda', 'Categoría', 'Color', 'Talla', 'Stock', 'Apartadas', 'Vendidas web 30 días', 'Precio', 'Activo']];
    for (const p of this.products) {
      for (const s of p.sizes) {
        rows.push([p.name, p.category, s.color, s.size, String(s.stock), String(s.reserved), String(s.sold30d), String(p.price), p.isActive ? 'Sí' : 'No']);
      }
    }
    const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(';')).join('\r\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `inventario-nova-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }
}
