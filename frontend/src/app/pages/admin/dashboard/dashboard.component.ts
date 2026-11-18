import { Component, OnInit } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { ApiService } from '../../../services/api.service';
import { FinanceSummary, Sale } from '../../../models/types';
import { BarChartComponent, ChartSeries } from '../finance/bar-chart.component';
import { CHANNEL_LABELS, COLOR_SALES, MONTHS, label, money, pct, periodLabel } from '../finance/finance-format';

interface Pending { count: number; title: string; detail: string; link: string; query?: Record<string, string>; tone: 'alert' | 'warn' | 'calm'; }

const todayCo = () => new Date(Date.now() - 5 * 3600_000).toISOString().slice(0, 10);
const WEEKDAYS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

@Component({
    selector: 'app-admin-dashboard',
    imports: [RouterLink, DatePipe, BarChartComponent],
    template: `
    <div class="mb-8">
      <h1 class="text-[28px] sm:text-[32px] font-bold tracking-tight text-[#1e1e1e]">{{ greeting }}</h1>
      <p class="text-[#6b6862] mt-1">{{ todayText }}</p>
    </div>

    <div class="grid grid-cols-1 xl:grid-cols-3 gap-6 mb-6">
      <!-- Mes en curso -->
      <section class="xl:col-span-2 bg-white rounded-2xl border border-[#e7e4df] p-6 sm:p-8">
        <div class="flex flex-wrap items-start justify-between gap-4 mb-6">
          <div>
            <p class="text-[#6b6862] text-sm">Ingresos de {{ monthName }} hasta hoy</p>
            <p class="text-[40px] sm:text-[48px] leading-none font-bold tracking-tight tabular-nums mt-2">{{ summary ? money(summary.kpis.grossSales) : '—' }}</p>
            @if (variation(); as v) {
              <p class="text-sm mt-2" [class.text-[#2e7d4f]]="v.up" [class.text-[#b3372f]]="!v.up">
                {{ v.up ? '▲' : '▼' }} {{ v.text }} <span class="text-[#6b6862]">frente a los {{ dayOfMonth }} días anteriores</span>
              </p>
            }
          </div>
          <a routerLink="/admin/finanzas" class="text-sm font-medium text-[#1e1e1e] underline underline-offset-4 decoration-[#b59677] hover:decoration-2">Ver finanzas</a>
        </div>

        <dl class="grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-4 pb-6 mb-6 border-b border-[#efece7]">
          <div><dt class="text-[13px] text-[#6b6862]">Utilidad neta</dt><dd class="text-xl font-semibold tabular-nums mt-0.5">{{ summary ? money(summary.kpis.netProfit) : '—' }}</dd></div>
          <div><dt class="text-[13px] text-[#6b6862]">Margen</dt><dd class="text-xl font-semibold tabular-nums mt-0.5">{{ summary ? pct(summary.kpis.margin) : '—' }}</dd></div>
          <div><dt class="text-[13px] text-[#6b6862]">Ventas</dt><dd class="text-xl font-semibold tabular-nums mt-0.5">{{ summary?.kpis?.orders ?? '—' }}</dd></div>
          <div><dt class="text-[13px] text-[#6b6862]">Prendas vendidas</dt><dd class="text-xl font-semibold tabular-nums mt-0.5">{{ summary?.kpis?.units ?? '—' }}</dd></div>
        </dl>

        @if (chartSeries.length) {
          <p class="text-[13px] text-[#6b6862] mb-2">Ventas por día</p>
          <app-bar-chart [labels]="chartLabels" [tooltipLabels]="chartTooltips" [series]="chartSeries" ariaLabel="Ventas por día del mes" />
        }
      </section>

      <!-- Pendientes -->
      <section class="bg-white rounded-2xl border border-[#e7e4df] p-6 sm:p-8 flex flex-col">
        <h2 class="text-lg font-semibold tracking-tight mb-1">Para revisar</h2>
        <p class="text-sm text-[#6b6862] mb-5">Lo que necesita tu atención hoy.</p>
        @if (loading) {
          <p class="text-sm text-[#6b6862]">Cargando…</p>
        } @else if (pending.length === 0) {
          <div class="flex-1 flex flex-col items-center justify-center text-center py-8">
            <span class="w-12 h-12 rounded-full bg-[#eef6f0] text-[#2e7d4f] flex items-center justify-center text-xl mb-3">✓</span>
            <p class="font-medium">Todo al día</p>
            <p class="text-sm text-[#6b6862]">Sin pedidos por despachar ni alertas de inventario.</p>
          </div>
        } @else {
          <ul class="divide-y divide-[#efece7] -mx-2">
            @for (p of pending; track p.title) {
              <li>
                <a [routerLink]="p.link" [queryParams]="p.query" class="flex items-center gap-4 px-2 py-3.5 rounded-lg hover:bg-[#f7f6f3]">
                  <span class="w-11 h-11 shrink-0 rounded-xl flex items-center justify-center text-lg font-bold tabular-nums"
                        [class.bg-[#fbeceb]]="p.tone === 'alert'" [class.text-[#b3372f]]="p.tone === 'alert'"
                        [class.bg-[#f8f0e4]]="p.tone === 'warn'" [class.text-[#8a6b4c]]="p.tone === 'warn'"
                        [class.bg-[#f1f0ed]]="p.tone === 'calm'" [class.text-[#1e1e1e]]="p.tone === 'calm'">{{ p.count }}</span>
                  <span class="flex-1 min-w-0">
                    <span class="block font-medium text-[15px]">{{ p.title }}</span>
                    <span class="block text-[13px] text-[#6b6862] truncate">{{ p.detail }}</span>
                  </span>
                  <svg class="w-4 h-4 text-[#a8a49c]" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="m9 6 6 6-6 6"/></svg>
                </a>
              </li>
            }
          </ul>
        }
      </section>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <section class="bg-white rounded-2xl border border-[#e7e4df] p-6 sm:p-8">
        <div class="flex items-center justify-between mb-4">
          <h2 class="text-lg font-semibold tracking-tight">Últimas ventas</h2>
          <a routerLink="/admin/finanzas" [queryParams]="{ tab: 'sales' }" class="text-sm text-[#6b6862] hover:text-[#1e1e1e]">Ver todas</a>
        </div>
        @for (s of recent; track s.id) {
          <div class="flex items-center gap-4 py-3 border-t border-[#efece7] first:border-0">
            <span class="w-9 h-9 shrink-0 rounded-full bg-[#f1f0ed] flex items-center justify-center text-sm font-semibold text-[#5b5852]">{{ initials(s.customerName) }}</span>
            <span class="flex-1 min-w-0">
              <span class="block text-[15px] truncate">{{ s.customerName }}</span>
              <span class="block text-[13px] text-[#6b6862] truncate">{{ channel(s.channel) }} · {{ itemsText(s) }}</span>
            </span>
            <span class="text-right">
              <span class="block font-semibold tabular-nums">{{ money(s.total) }}</span>
              <span class="block text-[12px] text-[#8a867e]">{{ s.paidAt | date:'d MMM, h:mm a' }}</span>
            </span>
          </div>
        } @empty {
          <p class="text-sm text-[#6b6862] py-6">Aún no hay ventas este mes. Cuando entre la primera aparecerá aquí.</p>
        }
      </section>

      <section class="bg-white rounded-2xl border border-[#e7e4df] p-6 sm:p-8">
        <div class="flex items-center justify-between mb-4">
          <h2 class="text-lg font-semibold tracking-tight">Lo más vendido del mes</h2>
          <a routerLink="/admin/inventario" class="text-sm text-[#6b6862] hover:text-[#1e1e1e]">Inventario</a>
        </div>
        @for (p of summary?.topProducts?.slice(0, 5) ?? []; track p.productId; let i = $index) {
          <div class="py-3 border-t border-[#efece7] first:border-0">
            <div class="flex items-baseline justify-between gap-3 mb-1.5">
              <span class="text-[15px] truncate">{{ p.name }}</span>
              <span class="text-[13px] text-[#6b6862] tabular-nums shrink-0">{{ p.units }} unid. · {{ money(p.revenue) }}</span>
            </div>
            <div class="h-1.5 rounded-full bg-[#f1f0ed]">
              <div class="h-1.5 rounded-full bg-[#b59677]" [style.width.%]="topShare(p.units)"></div>
            </div>
          </div>
        } @empty {
          <p class="text-sm text-[#6b6862] py-6">Sin ventas este mes todavía.</p>
        }
      </section>
    </div>
  `
})
export class AdminDashboardComponent implements OnInit {
  summary: FinanceSummary | null = null;
  recent: Sale[] = [];
  pending: Pending[] = [];
  loading = true;
  chartLabels: string[] = [];
  chartTooltips: string[] = [];
  chartSeries: ChartSeries[] = [];
  money = money;
  pct = pct;

  greeting = '';
  todayText = '';
  monthName = '';
  dayOfMonth = 0;

  constructor(private api: ApiService) {}

  ngOnInit() {
    const today = todayCo();
    const [y, m, d] = today.split('-').map(Number);
    const hour = new Date(Date.now() - 5 * 3600_000).getUTCHours();
    this.greeting = hour < 12 ? 'Buenos días' : hour < 19 ? 'Buenas tardes' : 'Buenas noches';
    const weekday = WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
    this.todayText = `Hoy es ${weekday} ${d} de ${MONTHS[m - 1].toLowerCase()}. Así va Nova FIT.`;
    this.monthName = MONTHS[m - 1].toLowerCase();
    this.dayOfMonth = d;

    const range = { from: `${today.slice(0, 7)}-01`, to: today };
    forkJoin({
      summary: this.api.getFinanceSummary(range),
      sales: this.api.getSales(range),
      orders: this.api.getOrders('APPROVED'),
      inventory: this.api.getInventory(),
      costs: this.api.getCosts(),
    }).subscribe({
      next: ({ summary, sales, orders, inventory, costs }) => {
        this.summary = summary;
        this.recent = sales.filter(s => s.status === 'APPROVED').slice(0, 6);
        const points = summary.series.points;
        this.chartLabels = points.map(p => String(Number(p.period.slice(8, 10))));
        this.chartTooltips = points.map(p => `${periodLabel(p.period, true)} · ${p.orders} ventas`);
        this.chartSeries = [{ name: 'Ventas', color: COLOR_SALES, values: points.map(p => p.revenue) }];

        const toShip = orders.filter(o => o.fulfillmentStatus === 'POR_DESPACHAR');
        const active = inventory.filter(p => p.isActive);
        const out = active.flatMap(p => p.sizes.filter(s => s.stock <= 0).map(s => `${p.name} ${s.size}`));
        const low = active.flatMap(p => p.sizes.filter(s => s.stock > 0 && s.stock <= 3).map(s => `${p.name} ${s.size}`));
        const noCost = costs.filter(c => c.isActive && c.cost === null);

        this.pending = [
          toShip.length && {
            count: toShip.length, tone: 'alert', link: '/admin/pedidos',
            title: toShip.length === 1 ? 'Pedido por despachar' : 'Pedidos por despachar',
            detail: toShip.slice(0, 3).map(o => o.customerName.split(' ')[0]).join(', ') + (toShip.length > 3 ? '…' : ''),
          },
          out.length && {
            count: out.length, tone: 'alert', link: '/admin/inventario',
            title: out.length === 1 ? 'Talla agotada' : 'Tallas agotadas', detail: out.slice(0, 3).join(', ') + (out.length > 3 ? '…' : ''),
          },
          low.length && {
            count: low.length, tone: 'warn', link: '/admin/inventario',
            title: 'Con 3 unidades o menos', detail: low.slice(0, 3).join(', ') + (low.length > 3 ? '…' : ''),
          },
          noCost.length && {
            count: noCost.length, tone: 'calm', link: '/admin/finanzas', query: { tab: 'costs' },
            title: noCost.length === 1 ? 'Prenda sin costo' : 'Prendas sin costo', detail: 'Sin costo la utilidad sale más alta de lo real',
          },
        ].filter(Boolean) as Pending[];
        this.loading = false;
      },
      error: () => { this.loading = false; },
    });
  }

  variation(): { up: boolean; text: string } | null {
    if (!this.summary) return null;
    const cur = this.summary.kpis.grossSales;
    const before = this.summary.previous.grossSales;
    if (!before) return null;
    const change = (cur - before) / before;
    return { up: change >= 0, text: pct(Math.abs(change)) };
  }

  topShare(units: number) {
    const max = Math.max(1, ...(this.summary?.topProducts ?? []).map(p => p.units));
    return (units / max) * 100;
  }

  initials(name: string) {
    return name.split(' ').filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join('');
  }

  channel(c: string) { return label(CHANNEL_LABELS, c); }

  itemsText(s: Sale) {
    const units = s.items.reduce((n, i) => n + i.quantity, 0);
    return `${units} ${units === 1 ? 'prenda' : 'prendas'}`;
  }
}
