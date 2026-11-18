import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ApiService } from '../../../services/api.service';
import { FinanceFilterOptions, FinanceRange } from '../../../models/types';
import { PAYMENT_LABELS, label } from './finance-format';
import { FinanceSummaryComponent } from './finance-summary.component';
import { FinanceClosesComponent } from './finance-closes.component';
import { FinanceSalesComponent } from './finance-sales.component';
import { FinanceExpensesComponent } from './finance-expenses.component';
import { FinanceCostsComponent } from './finance-costs.component';

type Tab = 'summary' | 'closes' | 'sales' | 'expenses' | 'costs';
type Preset = 'today' | 'week' | 'month' | 'lastMonth' | '30d' | 'quarter' | 'year' | 'lastYear' | 'custom';

/** Fecha de hoy en Colombia (YYYY-MM-DD) */
const todayCo = () => new Date(Date.now() - 5 * 3600_000).toISOString().slice(0, 10);
const shift = (date: string, days: number) => {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};
const lastDayOfMonth = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);

@Component({
    selector: 'app-admin-finance',
    imports: [FormsModule, RouterLink, FinanceSummaryComponent, FinanceClosesComponent, FinanceSalesComponent, FinanceExpensesComponent, FinanceCostsComponent],
    template: `
    <div class="w-full">
      <div class="flex flex-wrap items-end justify-between gap-4 mb-6">
        <div>
          <h1 class="font-display text-3xl font-bold text-nova-dark">Finanzas</h1>
        </div>
        <button (click)="exportExcel()" [disabled]="exporting"
                class="flex items-center gap-2 border border-green-700 text-green-800 px-4 py-2 rounded text-sm hover:bg-green-50 disabled:opacity-50">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v12m0 0l-4-4m4 4l4-4M4 20h16"/></svg>
          {{ exporting ? 'Generando Excel...' : (hasFilters() ? 'Exportar a Excel (filtrado)' : 'Exportar a Excel') }}
        </button>
      </div>

      <!-- Pestañas -->
      <div class="flex gap-1 border-b border-nova-blush mb-5 overflow-x-auto text-sm">
        @for (t of tabs; track t.id) {
          <button (click)="tab = t.id" class="px-4 py-2 -mb-px border-b-2 whitespace-nowrap transition"
                  [class.border-nova-dark]="tab === t.id" [class.text-nova-dark]="tab === t.id" [class.font-semibold]="tab === t.id"
                  [class.border-transparent]="tab !== t.id" [class.text-nova-gray]="tab !== t.id">{{ t.label }}</button>
        }
      </div>

      <!-- Filtro de fechas (no aplica a Cierres ni Costos) -->
      @if (tab !== 'closes' && tab !== 'costs') {
        <div class="flex flex-wrap items-center gap-2 mb-6 text-sm">
          @for (p of presets; track p.id) {
            <button (click)="applyPreset(p.id)" class="px-3 py-1.5 rounded-full border transition"
                    [class.bg-nova-dark]="preset === p.id" [class.text-white]="preset === p.id" [class.border-nova-dark]="preset === p.id"
                    [class.border-nova-blush]="preset !== p.id" [class.bg-white]="preset !== p.id">{{ p.label }}</button>
          }
          <div class="flex items-center gap-1 ml-auto">
            <input type="date" [(ngModel)]="from" (change)="customRange()" [max]="to" class="border border-nova-blush rounded px-2 py-1.5 bg-white">
            <span class="text-nova-gray">a</span>
            <input type="date" [(ngModel)]="to" (change)="customRange()" [min]="from" [max]="today" class="border border-nova-blush rounded px-2 py-1.5 bg-white">
          </div>
        </div>
      }

      <!-- Filtros (aplican al Resumen, Cierres, Ventas y al Excel) -->
      @if (tab === 'summary' || tab === 'closes' || tab === 'sales') {
        <div class="flex flex-wrap items-center gap-2 mb-6 text-sm bg-white border border-nova-blush rounded-lg p-3">
          <span class="text-nova-gray mr-1">Filtrar:</span>
          <select [(ngModel)]="channel" (ngModelChange)="applyFilters()" class="border border-nova-blush rounded px-2 py-1.5 bg-white">
            <option value="">Todos los canales</option>
            <option value="WEB">Tienda web</option>
            <option value="MANUAL">Ventas directas</option>
          </select>
          <select [(ngModel)]="categoryId" (ngModelChange)="productId = null; applyFilters()" class="border border-nova-blush rounded px-2 py-1.5 bg-white">
            <option [ngValue]="null">Todas las categorías</option>
            @for (c of options.categories; track c.id) { <option [ngValue]="c.id">{{ c.name }}</option> }
          </select>
          <select [(ngModel)]="productId" (ngModelChange)="applyFilters()" class="border border-nova-blush rounded px-2 py-1.5 bg-white max-w-[220px]">
            <option [ngValue]="null">Todas las prendas</option>
            @for (p of productOptions(); track p.id) { <option [ngValue]="p.id">{{ p.name }}</option> }
          </select>
          <select [(ngModel)]="payment" (ngModelChange)="applyFilters()" class="border border-nova-blush rounded px-2 py-1.5 bg-white">
            <option value="">Todos los medios de pago</option>
            @for (m of options.payments; track m) { <option [value]="m">{{ paymentLabel(m) }}</option> }
          </select>
          @if (hasFilters()) {
            <button (click)="clearFilters()" class="underline text-nova-gray hover:text-nova-rose ml-1">Quitar filtros</button>
          }
          <span class="ml-auto text-xs text-nova-gray">El Excel se genera con estas fechas y filtros.</span>
        </div>
      }

      @if (exportError) { <div class="bg-red-50 text-red-600 p-3 rounded mb-4 text-sm">{{ exportError }}</div> }

      @switch (tab) {
        @case ('summary') { <app-finance-summary [range]="range" (goTo)="tab = $any($event)" /> }
        @case ('closes') { <app-finance-closes [filters]="filters" /> }
        @case ('sales') { <app-finance-sales [range]="range" /> }
        @case ('expenses') { <app-finance-expenses [range]="range" /> }
        @case ('costs') { <app-finance-costs /> }
      }
    </div>
  `
})
export class AdminFinanceComponent implements OnInit {
  tab: Tab = 'summary';
  tabs: { id: Tab; label: string }[] = [
    { id: 'summary', label: 'Resumen' },
    { id: 'closes', label: 'Cierres mes / año' },
    { id: 'sales', label: 'Ventas' },
    { id: 'expenses', label: 'Gastos' },
    { id: 'costs', label: 'Costos y precios' },
  ];
  presets: { id: Preset; label: string }[] = [
    { id: 'today', label: 'Hoy' },
    { id: 'week', label: '7 días' },
    { id: '30d', label: '30 días' },
    { id: 'month', label: 'Este mes' },
    { id: 'lastMonth', label: 'Mes pasado' },
    { id: 'quarter', label: 'Trimestre' },
    { id: 'year', label: 'Este año' },
    { id: 'lastYear', label: 'Año pasado' },
  ];
  preset: Preset = 'month';
  today = todayCo();
  from = '';
  to = '';
  range: FinanceRange = { from: '', to: '' };
  exporting = false;
  exportError = '';

  // Filtros
  options: FinanceFilterOptions = { categories: [], products: [], payments: [] };
  channel: '' | 'WEB' | 'MANUAL' = '';
  categoryId: number | null = null;
  productId: number | null = null;
  payment = '';
  filters: Partial<FinanceRange> = {};

  constructor(private api: ApiService, private route: ActivatedRoute) {}

  ngOnInit() {
    const tab = this.route.snapshot.queryParamMap.get('tab') as Tab | null;
    if (tab && this.tabs.some(t => t.id === tab)) this.tab = tab;
    this.applyPreset('month');
    this.api.getFinanceFilters().subscribe(o => (this.options = o));
  }

  productOptions() {
    return this.categoryId ? this.options.products.filter(p => p.categoryId === this.categoryId) : this.options.products;
  }

  paymentLabel(m: string) { return label(PAYMENT_LABELS, m); }

  hasFilters() { return !!(this.channel || this.categoryId || this.productId || this.payment); }

  /** Crea objetos nuevos para que las pestañas noten el cambio y recarguen */
  applyFilters() {
    this.filters = { channel: this.channel, categoryId: this.categoryId, productId: this.productId, payment: this.payment };
    this.range = { ...this.filters, from: this.from, to: this.to };
  }

  clearFilters() {
    this.channel = '';
    this.categoryId = null;
    this.productId = null;
    this.payment = '';
    this.applyFilters();
  }

  applyPreset(p: Preset) {
    const t = todayCo();
    const [y, m] = t.split('-').map(Number);
    const ranges: Record<Exclude<Preset, 'custom'>, [string, string]> = {
      today: [t, t],
      week: [shift(t, -6), t],
      '30d': [shift(t, -29), t],
      month: [`${t.slice(0, 7)}-01`, t],
      lastMonth: m === 1
        ? [`${y - 1}-12-01`, `${y - 1}-12-31`]
        : [`${y}-${String(m - 1).padStart(2, '0')}-01`, lastDayOfMonth(y, m - 1)],
      quarter: [`${y}-${String(Math.floor((m - 1) / 3) * 3 + 1).padStart(2, '0')}-01`, t],
      year: [`${y}-01-01`, t],
      lastYear: [`${y - 1}-01-01`, `${y - 1}-12-31`],
    };
    if (p === 'custom') return;
    this.preset = p;
    [this.from, this.to] = ranges[p];
    this.range = { ...this.filters, from: this.from, to: this.to };
  }

  customRange() {
    if (!this.from || !this.to) return;
    if (this.from > this.to) [this.from, this.to] = [this.to, this.from];
    this.preset = 'custom';
    this.range = { ...this.filters, from: this.from, to: this.to };
  }

  exportExcel() {
    this.exporting = true;
    this.exportError = '';
    this.api.exportFinance(this.range).subscribe({
      next: blob => {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `nova-finanzas-${this.range.from}_a_${this.range.to}${this.hasFilters() ? '-filtrado' : ''}.xlsx`;
        a.click();
        URL.revokeObjectURL(a.href);
        this.exporting = false;
      },
      error: () => { this.exporting = false; this.exportError = 'No se pudo generar el Excel'; },
    });
  }
}
