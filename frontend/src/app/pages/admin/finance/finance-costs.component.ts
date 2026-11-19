import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../../services/api.service';
import { CostRow } from '../../../models/types';
import { money, pct } from './finance-format';

interface EditableRow extends CostRow {
  draftPrice: number;
  draftCost: number | null;
  saved?: boolean;
  saving?: boolean;
}

@Component({
    selector: 'app-finance-costs',
    imports: [FormsModule],
    template: `
    @if (error) { <div class="bg-red-50 text-red-600 p-3 rounded mb-4 text-sm">{{ error }}</div> }

    <div class="grid grid-cols-1 md:grid-cols-4 gap-3 mb-6">
      <div class="bg-white border border-nova-blush rounded-lg p-4">
        <p class="text-[11px] text-nova-gray uppercase tracking-wider">Inventario a costo</p>
        <p class="text-xl font-bold text-nova-dark">{{ money(stockAtCost()) }}</p>
        <p class="text-xs text-nova-gray">Plata invertida en prendas en bodega</p>
      </div>
      <div class="bg-white border border-nova-blush rounded-lg p-4">
        <p class="text-[11px] text-nova-gray uppercase tracking-wider">Inventario a precio de venta</p>
        <p class="text-xl font-bold text-nova-dark">{{ money(stockAtPrice()) }}</p>
        <p class="text-xs text-nova-gray">Si se vendiera todo</p>
      </div>
      <div class="bg-white border border-nova-blush rounded-lg p-4">
        <p class="text-[11px] text-nova-gray uppercase tracking-wider">Ganancia potencial</p>
        <p class="text-xl font-bold text-nova-dark">{{ money(stockAtPrice() - stockAtCost()) }}</p>
        <p class="text-xs text-nova-gray">Solo prendas con costo</p>
      </div>
      <div class="bg-white border rounded-lg p-4" [class.border-yellow-400]="missing() > 0" [class.border-nova-blush]="missing() === 0">
        <p class="text-[11px] text-nova-gray uppercase tracking-wider">Prendas sin costo</p>
        <p class="text-xl font-bold" [class.text-yellow-600]="missing() > 0" [class.text-nova-dark]="missing() === 0">{{ missing() }}</p>
        <p class="text-xs text-nova-gray">Agrégalo para ver la utilidad real</p>
      </div>
    </div>

    <p class="text-sm text-nova-gray mb-3">Escribe cuánto te cuesta cada prenda (producción o compra, por unidad). Cada venta guarda el costo del momento, así que cambiarlo después no altera ventas pasadas.</p>

    <div class="bg-white border border-nova-blush rounded-lg overflow-x-auto mb-8">
      <table class="w-full text-sm">
        <thead class="bg-nova-cream text-nova-gray">
          <tr>
            <th class="text-left px-3 py-2 font-medium">Prenda</th>
            <th class="text-right px-3 py-2 font-medium">Precio de venta</th>
            <th class="text-right px-3 py-2 font-medium">Costo por unidad</th>
            <th class="text-right px-3 py-2 font-medium">Ganancia por unidad</th>
            <th class="text-right px-3 py-2 font-medium">Margen</th>
            <th class="text-right px-3 py-2 font-medium">Stock</th>
            <th class="px-3 py-2"></th>
          </tr>
        </thead>
        <tbody>
          @for (r of rows; track r.id) {
            <tr class="border-t border-nova-pink" [class.bg-yellow-50]="r.draftCost === null">
              <td class="px-3 py-2">
                <span class="text-nova-dark">{{ r.name }}</span>
                <span class="block text-xs text-nova-gray">{{ r.category }}@if (!r.isActive) { · inactivo }</span>
              </td>
              <td class="px-3 py-2 text-right"><input type="number" min="0" [(ngModel)]="r.draftPrice" class="w-28 text-right border border-nova-blush rounded px-2 py-1"></td>
              <td class="px-3 py-2 text-right"><input type="number" min="0" [(ngModel)]="r.draftCost" placeholder="Sin costo" class="w-28 text-right border border-nova-blush rounded px-2 py-1"></td>
              <td class="px-3 py-2 text-right" [class.text-red-600]="unitProfit(r) !== null && unitProfit(r)! < 0">{{ money(unitProfit(r)) }}</td>
              <td class="px-3 py-2 text-right">{{ unitProfit(r) === null ? '—' : pct(unitProfit(r)! / r.draftPrice) }}</td>
              <td class="px-3 py-2 text-right">{{ r.stock }}</td>
              <td class="px-3 py-2 text-right whitespace-nowrap">
                @if (dirty(r)) {
                  <button (click)="saveRow(r)" [disabled]="r.saving" class="bg-nova-dark text-white text-xs px-3 py-1 rounded disabled:opacity-50">Guardar</button>
                } @else if (r.saved) {
                  <span class="text-green-700 text-xs">✓ Guardado</span>
                }
              </td>
            </tr>
          }
        </tbody>
      </table>
    </div>

    <div class="bg-white border border-nova-blush rounded-lg p-5 max-w-xl">
      <h3 class="font-semibold text-nova-dark mb-1">Comisión de Wompi</h3>
      <p class="text-xs text-nova-gray mb-3">Se usa para estimar cuánto se lleva Wompi de cada venta web (porcentaje + valor fijo, más IVA).</p>
      <div class="flex flex-wrap items-end gap-3 text-sm">
        <div><label class="block mb-1">Porcentaje (%)</label><input type="number" step="0.01" min="0" [(ngModel)]="feePercent" class="w-24 border border-nova-blush rounded px-2 py-1.5"></div>
        <div><label class="block mb-1">Fijo por venta ($)</label><input type="number" min="0" [(ngModel)]="feeFixed" class="w-28 border border-nova-blush rounded px-2 py-1.5"></div>
        <button (click)="saveFees()" class="bg-nova-dark text-white px-4 py-1.5 rounded">Guardar</button>
        @if (feesSaved) { <span class="text-green-700 text-xs">✓ Guardado</span> }
      </div>
    </div>
  `
})
export class FinanceCostsComponent implements OnInit {
  rows: EditableRow[] = [];
  feePercent = 2.65;
  feeFixed = 700;
  feesSaved = false;
  error = '';
  money = money;
  pct = pct;

  constructor(private api: ApiService) {}

  ngOnInit() {
    this.api.getCosts().subscribe({
      next: rows => {
        // Las prendas sin costo primero, para completarlas
        this.rows = rows
          .map(r => ({ ...r, draftPrice: r.price, draftCost: r.cost }))
          .sort((a, b) => Number(a.cost !== null) - Number(b.cost !== null) || a.name.localeCompare(b.name));
      },
      error: () => (this.error = 'No se pudieron cargar los productos'),
    });
    this.api.getAdminSettings().subscribe(s => {
      if (s['wompiFeePercent']) this.feePercent = parseFloat(s['wompiFeePercent']);
      if (s['wompiFeeFixed']) this.feeFixed = parseFloat(s['wompiFeeFixed']);
    });
  }

  private costOf(r: EditableRow): number | null {
    return r.draftCost === null || (r.draftCost as unknown) === '' ? null : Number(r.draftCost);
  }

  unitProfit(r: EditableRow): number | null {
    const cost = this.costOf(r);
    return cost === null ? null : Number(r.draftPrice) - cost;
  }

  dirty(r: EditableRow) { return Number(r.draftPrice) !== r.price || this.costOf(r) !== r.cost; }

  missing() { return this.rows.filter(r => r.cost === null && r.isActive).length; }
  stockAtCost() { return this.rows.reduce((t, r) => t + (r.cost ?? 0) * r.stock, 0); }
  stockAtPrice() { return this.rows.reduce((t, r) => t + (r.cost !== null ? r.price * r.stock : 0), 0); }

  saveRow(r: EditableRow) {
    r.saving = true;
    const cost = this.costOf(r);
    this.api.updateCost(r.id, { price: Number(r.draftPrice), cost }).subscribe({
      next: () => { r.price = Number(r.draftPrice); r.cost = cost; r.saving = false; r.saved = true; },
      error: err => { r.saving = false; this.error = err?.error?.message || 'No se pudo guardar'; },
    });
  }

  saveFees() {
    this.feesSaved = false;
    this.api.updateSettings({ wompiFeePercent: String(this.feePercent), wompiFeeFixed: String(this.feeFixed) }).subscribe({
      next: () => (this.feesSaved = true),
      error: () => (this.error = 'No se pudo guardar la comisión'),
    });
  }
}
