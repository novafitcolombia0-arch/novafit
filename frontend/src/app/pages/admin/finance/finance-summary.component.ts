import { Component, EventEmitter, Input, OnChanges, Output } from '@angular/core';
import { ApiService } from '../../../services/api.service';
import { FinanceRange, FinanceSummary, GroupRow, Kpis } from '../../../models/types';
import { BarChartComponent, ChartSeries } from './bar-chart.component';
import {
  CHANNEL_LABELS, COLOR_PROFIT, COLOR_SALES, EXPENSE_LABELS, PAYMENT_LABELS, label, money, pct, periodLabel,
} from './finance-format';

interface KpiCard {
  key: keyof Kpis;
  title: string;
  format: 'money' | 'int';
  hint?: (k: Kpis) => string;
  lowerIsBetter?: boolean;
  strong?: boolean;
}

@Component({
    selector: 'app-finance-summary',
    imports: [BarChartComponent],
    template: `
    @if (error) { <div class="bg-red-50 text-red-600 p-3 rounded mb-4 text-sm">{{ error }}</div> }
    @if (!data) {
      <p class="text-nova-gray text-center py-16">{{ error ? '' : 'Cargando...' }}</p>
    } @else {
      @if (data.kpis.unitsWithoutCost > 0) {
        <div class="bg-yellow-50 border border-yellow-200 text-yellow-800 rounded-lg p-3 mb-4 text-sm flex flex-wrap items-center gap-2">
          <span>⚠ {{ data.kpis.unitsWithoutCost }} prendas vendidas en este periodo no tienen costo registrado, así que la utilidad aparece más alta de lo real.</span>
          <button (click)="goTo.emit('costs')" class="underline font-medium">Agregar costos</button>
        </div>
      }

      @if (filtered()) {
        <div class="bg-nova-pink rounded-lg p-3 mb-4 text-sm text-nova-dark">
          Con filtros, los <strong>gastos</strong> del negocio no se restan (no pertenecen a una prenda o canal). El envío y la comisión se reparten en proporción a lo vendido.
        </div>
      }

      <!-- Indicadores -->
      <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 mb-6">
        @for (c of cards; track c.key) {
          <div class="bg-white border rounded-lg p-4" [class.border-nova-dark]="c.strong" [class.border-nova-blush]="!c.strong">
            <p class="text-[11px] text-nova-gray uppercase tracking-wider">{{ c.title }}</p>
            <p class="text-xl font-bold text-nova-dark mt-1" [class.text-red-600]="c.key === 'netProfit' && data.kpis.netProfit < 0">
              {{ c.format === 'money' ? money(data.kpis[c.key]) : data.kpis[c.key].toLocaleString('es-CO') }}
            </p>
            @if (c.hint) { <p class="text-xs text-nova-gray">{{ c.hint(data.kpis) }}</p> }
            @if (variation(c); as v) {
              <p class="text-xs mt-1" [class.text-green-700]="v.good" [class.text-red-600]="!v.good && v.text !== '='" [class.text-nova-gray]="v.text === '='">
                {{ v.text }} <span class="text-nova-gray">vs periodo anterior</span>
              </p>
            }
          </div>
        }
      </div>

      <!-- Gráfica -->
      <div class="bg-white border border-nova-blush rounded-lg p-4 mb-6">
        <h3 class="font-semibold text-nova-dark mb-3">Ventas y utilidad neta por {{ data.series.groupBy === 'day' ? 'día' : 'mes' }}</h3>
        <app-bar-chart [labels]="chartLabels" [tooltipLabels]="chartTooltips" [series]="chartSeries"
                       ariaLabel="Ventas y utilidad neta por periodo" />
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <!-- Más vendidos -->
        <div class="bg-white border border-nova-blush rounded-lg p-4">
          <h3 class="font-semibold text-nova-dark mb-3">Prendas más vendidas</h3>
          @if (data.topProducts.length === 0) { <p class="text-sm text-nova-gray">Sin ventas en este periodo.</p> }
          <table class="w-full text-sm">
            @if (data.topProducts.length) {
              <thead class="text-nova-gray text-xs"><tr>
                <th class="text-left py-1">#</th><th class="text-left py-1">Prenda</th>
                <th class="text-right py-1">Unid.</th><th class="text-right py-1">Ventas</th><th class="text-right py-1">Utilidad</th>
              </tr></thead>
            }
            <tbody>
              @for (p of data.topProducts; track p.productId; let i = $index) {
                <tr class="border-t border-nova-pink">
                  <td class="py-1.5 text-nova-gray">{{ i + 1 }}</td>
                  <td class="py-1.5 text-nova-dark">{{ p.name }} @if (i === 0) { <span title="La más vendida">🏆</span> }</td>
                  <td class="py-1.5 text-right">{{ p.units }}</td>
                  <td class="py-1.5 text-right">{{ money(p.revenue) }}</td>
                  <td class="py-1.5 text-right">{{ money(p.profit) }}@if (p.missingCost) { <span class="text-yellow-600" title="Falta el costo">*</span> }</td>
                </tr>
              }
            </tbody>
          </table>
        </div>

        <!-- Más rentables + sin ventas -->
        <div class="space-y-6">
          <div class="bg-white border border-nova-blush rounded-lg p-4">
            <h3 class="font-semibold text-nova-dark mb-3">Las que más dejan ganancia</h3>
            @for (p of data.mostProfitable; track p.productId) {
              <div class="flex justify-between text-sm py-1 border-t border-nova-pink first:border-0">
                <span class="text-nova-dark">{{ p.name }}</span>
                <span>{{ money(p.profit) }} <span class="text-nova-gray text-xs">({{ pct(p.revenue ? p.profit / p.revenue : 0) }})</span></span>
              </div>
            } @empty { <p class="text-sm text-nova-gray">Sin ventas en este periodo.</p> }
          </div>
          <div class="bg-white border border-nova-blush rounded-lg p-4">
            <h3 class="font-semibold text-nova-dark mb-1">Prendas quietas</h3>
            <p class="text-xs text-nova-gray mb-3">Activas, con stock y sin ninguna venta en este periodo. Candidatas a promoción.</p>
            @for (p of data.slowMovers; track p.id) {
              <div class="flex justify-between text-sm py-1 border-t border-nova-pink first:border-0">
                <span class="text-nova-dark">{{ p.name }}</span>
                <span class="text-nova-gray">{{ p.stock }} unid. · {{ money(p.cost !== null ? p.cost * p.stock : p.price * p.stock) }} {{ p.cost !== null ? 'a costo' : 'a precio' }}</span>
              </div>
            } @empty { <p class="text-sm text-nova-gray">Todas las prendas con stock tuvieron ventas. 👏</p> }
          </div>
        </div>
      </div>

      <!-- Desgloses -->
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        @for (b of breakdowns; track b.title) {
          <div class="bg-white border border-nova-blush rounded-lg p-4">
            <h3 class="font-semibold text-nova-dark mb-3">{{ b.title }}</h3>
            @for (r of b.rows; track r.name) {
              <div class="mb-2">
                <div class="flex justify-between text-sm">
                  <span class="text-nova-dark">{{ r.label }}</span>
                  <span class="text-nova-gray">{{ r.detail }}</span>
                </div>
                <div class="h-2 bg-nova-pink rounded mt-1">
                  <div class="h-2 rounded-r" [style.width.%]="r.share * 100" [style.background]="b.color"></div>
                </div>
              </div>
            } @empty { <p class="text-sm text-nova-gray">Sin datos.</p> }
          </div>
        }
      </div>
    }
  `
})
export class FinanceSummaryComponent implements OnChanges {
  @Input({ required: true }) range!: FinanceRange;
  @Output() goTo = new EventEmitter<string>();

  data: FinanceSummary | null = null;
  error = '';
  chartLabels: string[] = [];
  chartTooltips: string[] = [];
  chartSeries: ChartSeries[] = [];
  breakdowns: { title: string; color: string; rows: { name: string; label: string; detail: string; share: number }[] }[] = [];
  money = money;
  pct = pct;

  cards: KpiCard[] = [
    { key: 'grossSales', title: 'Ingresos totales', format: 'money', hint: k => `Prendas ${money(k.revenue)} + envíos ${money(k.shipping)}` },
    { key: 'netProfit', title: 'Utilidad neta', format: 'money', hint: k => `Margen ${pct(k.margin)}`, strong: true },
    { key: 'grossProfit', title: 'Utilidad bruta', format: 'money', hint: k => `Margen bruto ${pct(k.grossMargin)}` },
    { key: 'cogs', title: 'Costo de prendas', format: 'money', lowerIsBetter: true },
    { key: 'expenses', title: 'Gastos', format: 'money', lowerIsBetter: true, hint: k => `+ comisiones Wompi ${money(k.paymentFees)}` },
    { key: 'orders', title: 'Ventas', format: 'int' },
    { key: 'units', title: 'Prendas vendidas', format: 'int' },
    { key: 'avgTicket', title: 'Ticket promedio', format: 'money' },
    { key: 'shipping', title: 'Envíos cobrados', format: 'money' },
    { key: 'paymentFees', title: 'Comisiones Wompi', format: 'money', lowerIsBetter: true, hint: () => 'Estimadas' },
  ];

  constructor(private api: ApiService) {}

  filtered() { return !!(this.range.channel || this.range.payment || this.range.categoryId || this.range.productId); }

  ngOnChanges() {
    this.error = '';
    this.api.getFinanceSummary(this.range).subscribe({
      next: data => { this.data = data; this.build(); },
      error: () => { this.error = 'No se pudo cargar el resumen'; },
    });
  }

  variation(c: KpiCard): { text: string; good: boolean } | null {
    if (!this.data) return null;
    const cur = this.data.kpis[c.key];
    const before = this.data.previous[c.key];
    if (!before) return cur ? null : { text: '=', good: true };
    const change = (cur - before) / Math.abs(before);
    if (Math.abs(change) < 0.0005) return { text: '=', good: true };
    const up = change > 0;
    return { text: `${up ? '▲' : '▼'} ${pct(Math.abs(change))}`, good: c.lowerIsBetter ? !up : up };
  }

  private build() {
    const d = this.data!;
    const points = d.series.points;
    this.chartLabels = points.map(p => periodLabel(p.period));
    this.chartTooltips = points.map(p => `${periodLabel(p.period, true)} · ${p.orders} ventas`);
    this.chartSeries = [
      { name: 'Ventas de prendas', color: COLOR_SALES, values: points.map(p => p.revenue) },
      { name: 'Utilidad neta', color: COLOR_PROFIT, values: points.map(p => p.netProfit) },
    ];

    const fromRows = (rows: GroupRow[], map: Record<string, string> | null, metric: 'revenue' | 'units') => {
      const max = Math.max(1, ...rows.map(r => r[metric]));
      return rows.map(r => ({
        name: r.name,
        label: map ? label(map, r.name) : r.name,
        detail: metric === 'units'
          ? `${r.units} unid. · ${money(r.revenue)}`
          : `${money(r.revenue)}${r.orders !== undefined ? ` · ${r.orders} ventas` : ` · ${r.units} unid.`}`,
        share: Math.max(0, r[metric]) / max,
      }));
    };
    const expMax = Math.max(1, ...d.expensesByCategory.map(e => e.total));
    this.breakdowns = [
      { title: 'Por talla', color: COLOR_SALES, rows: fromRows(d.bySize, null, 'units') },
      { title: 'Por categoría', color: COLOR_SALES, rows: fromRows(d.byCategory, null, 'revenue') },
      { title: 'Por canal', color: COLOR_SALES, rows: fromRows(d.byChannel, CHANNEL_LABELS, 'revenue') },
      { title: 'Por medio de pago', color: COLOR_SALES, rows: fromRows(d.byPayment, PAYMENT_LABELS, 'revenue') },
      { title: 'Por departamento', color: COLOR_SALES, rows: fromRows(d.byDepartment, null, 'revenue') },
      {
        title: 'Gastos por categoría', color: COLOR_PROFIT,
        rows: d.expensesByCategory.map(e => ({ name: e.name, label: label(EXPENSE_LABELS, e.name), detail: money(e.total), share: e.total / expMax })),
      },
    ];
  }
}
