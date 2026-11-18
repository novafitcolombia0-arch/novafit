import { Component, Input, OnChanges } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../../services/api.service';
import { FinanceRange, Kpis, MonthlyClose, YearlyCloseRow } from '../../../models/types';
import { BarChartComponent, ChartSeries } from './bar-chart.component';
import { COLOR_PROFIT, COLOR_SALES, MONTHS, MONTHS_SHORT, money, pct } from './finance-format';

@Component({
    selector: 'app-finance-closes',
    imports: [FormsModule, BarChartComponent],
    template: `
    @if (error) { <div class="bg-red-50 text-red-600 p-3 rounded mb-4 text-sm">{{ error }}</div> }

    <div class="flex items-center gap-3 mb-4">
      <h2 class="font-semibold text-lg text-nova-dark">Cierre mensual</h2>
      <select [(ngModel)]="year" (ngModelChange)="loadMonthly()" class="border border-nova-blush rounded px-3 py-1.5 bg-white text-sm">
        @for (y of years; track y) { <option [ngValue]="y">{{ y }}</option> }
      </select>
    </div>

    @if (monthly) {
      <div class="bg-white border border-nova-blush rounded-lg p-4 mb-4">
        <app-bar-chart [labels]="monthLabels" [tooltipLabels]="monthTooltips" [series]="monthSeries"
                       [ariaLabel]="'Ventas y utilidad neta por mes ' + year" />
      </div>

      <div class="bg-white border border-nova-blush rounded-lg overflow-x-auto mb-8">
        <table class="w-full text-sm whitespace-nowrap">
          <thead class="bg-nova-cream text-nova-gray">
            <tr>
              <th class="text-left px-3 py-2 font-medium">Mes</th>
              <th class="text-right px-3 py-2 font-medium">Ventas prendas</th>
              <th class="text-right px-3 py-2 font-medium">Envíos</th>
              <th class="text-right px-3 py-2 font-medium">Costo prendas</th>
              <th class="text-right px-3 py-2 font-medium">Utilidad bruta</th>
              <th class="text-right px-3 py-2 font-medium">Comisiones</th>
              <th class="text-right px-3 py-2 font-medium">Gastos</th>
              <th class="text-right px-3 py-2 font-medium">Utilidad neta</th>
              <th class="text-right px-3 py-2 font-medium">Margen</th>
              <th class="text-right px-3 py-2 font-medium">Ventas</th>
              <th class="text-right px-3 py-2 font-medium">Prendas</th>
            </tr>
          </thead>
          <tbody>
            @for (m of monthly.months; track m.month) {
              <tr class="border-t border-nova-pink" [class.text-nova-gray]="!m.orders && !m.expenses">
                <td class="px-3 py-2">{{ months[m.month - 1] }}</td>
                <td class="px-3 py-2 text-right">{{ money(m.revenue) }}</td>
                <td class="px-3 py-2 text-right">{{ money(m.shipping) }}</td>
                <td class="px-3 py-2 text-right">{{ money(m.cogs) }}</td>
                <td class="px-3 py-2 text-right">{{ money(m.grossProfit) }}</td>
                <td class="px-3 py-2 text-right">{{ money(m.paymentFees) }}</td>
                <td class="px-3 py-2 text-right">{{ money(m.expenses) }}</td>
                <td class="px-3 py-2 text-right font-medium" [class.text-red-600]="m.netProfit < 0">{{ money(m.netProfit) }}</td>
                <td class="px-3 py-2 text-right">{{ m.grossSales ? pct(m.margin) : '—' }}</td>
                <td class="px-3 py-2 text-right">{{ m.orders }}</td>
                <td class="px-3 py-2 text-right">{{ m.units }}</td>
              </tr>
            }
            <tr class="border-t-2 border-nova-dark bg-nova-pink font-semibold text-nova-dark">
              <td class="px-3 py-2">Cierre {{ monthly.year }}</td>
              <td class="px-3 py-2 text-right">{{ money(monthly.total.revenue) }}</td>
              <td class="px-3 py-2 text-right">{{ money(monthly.total.shipping) }}</td>
              <td class="px-3 py-2 text-right">{{ money(monthly.total.cogs) }}</td>
              <td class="px-3 py-2 text-right">{{ money(monthly.total.grossProfit) }}</td>
              <td class="px-3 py-2 text-right">{{ money(monthly.total.paymentFees) }}</td>
              <td class="px-3 py-2 text-right">{{ money(monthly.total.expenses) }}</td>
              <td class="px-3 py-2 text-right" [class.text-red-600]="monthly.total.netProfit < 0">{{ money(monthly.total.netProfit) }}</td>
              <td class="px-3 py-2 text-right">{{ monthly.total.grossSales ? pct(monthly.total.margin) : '—' }}</td>
              <td class="px-3 py-2 text-right">{{ monthly.total.orders }}</td>
              <td class="px-3 py-2 text-right">{{ monthly.total.units }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      @if (best) {
        <p class="text-sm text-nova-gray mb-8">
          Mejor mes de {{ monthly.year }}: <strong class="text-nova-dark">{{ months[best.month - 1] }}</strong>
          con {{ money(best.grossSales) }} en ingresos y {{ money(best.netProfit) }} de utilidad neta.
        </p>
      }
    }

    <h2 class="font-semibold text-lg text-nova-dark mb-4">Cierre anual</h2>
    <div class="bg-white border border-nova-blush rounded-lg overflow-x-auto">
      <table class="w-full text-sm whitespace-nowrap">
        <thead class="bg-nova-cream text-nova-gray">
          <tr>
            <th class="text-left px-3 py-2 font-medium">Año</th>
            <th class="text-right px-3 py-2 font-medium">Ingresos totales</th>
            <th class="text-right px-3 py-2 font-medium">Costo prendas</th>
            <th class="text-right px-3 py-2 font-medium">Gastos + comisiones</th>
            <th class="text-right px-3 py-2 font-medium">Utilidad neta</th>
            <th class="text-right px-3 py-2 font-medium">Margen</th>
            <th class="text-right px-3 py-2 font-medium">Ventas</th>
            <th class="text-right px-3 py-2 font-medium">Prendas</th>
            <th class="text-right px-3 py-2 font-medium">Ticket promedio</th>
          </tr>
        </thead>
        <tbody>
          @for (y of yearly; track y.year) {
            <tr class="border-t border-nova-pink">
              <td class="px-3 py-2 font-medium">{{ y.year }}</td>
              <td class="px-3 py-2 text-right">{{ money(y.grossSales) }}</td>
              <td class="px-3 py-2 text-right">{{ money(y.cogs) }}</td>
              <td class="px-3 py-2 text-right">{{ money(y.expenses + y.paymentFees) }}</td>
              <td class="px-3 py-2 text-right font-medium" [class.text-red-600]="y.netProfit < 0">{{ money(y.netProfit) }}</td>
              <td class="px-3 py-2 text-right">{{ y.grossSales ? pct(y.margin) : '—' }}</td>
              <td class="px-3 py-2 text-right">{{ y.orders }}</td>
              <td class="px-3 py-2 text-right">{{ y.units }}</td>
              <td class="px-3 py-2 text-right">{{ money(y.avgTicket) }}</td>
            </tr>
          }
        </tbody>
      </table>
    </div>
  `
})
export class FinanceClosesComponent implements OnChanges {
  @Input() filters: Partial<FinanceRange> = {};
  year = new Date().getFullYear();
  years: number[] = [];
  monthly: MonthlyClose | null = null;
  yearly: YearlyCloseRow[] = [];
  best: (Kpis & { month: number }) | null = null;
  monthLabels = MONTHS_SHORT;
  monthTooltips = MONTHS;
  monthSeries: ChartSeries[] = [];
  months = MONTHS;
  error = '';
  money = money;
  pct = pct;

  constructor(private api: ApiService) {}

  ngOnChanges() {
    this.years = [this.year];
    this.api.getYearlyClose(this.filters).subscribe({
      next: rows => {
        this.yearly = rows;
        this.years = rows.map(r => r.year);
        if (!this.years.includes(this.year)) this.years.unshift(this.year);
      },
      error: () => { this.error = 'No se pudo cargar el cierre anual'; },
    });
    this.loadMonthly();
  }

  loadMonthly() {
    this.api.getMonthlyClose(this.year, this.filters).subscribe({
      next: data => {
        this.monthly = data;
        this.monthSeries = [
          { name: 'Ventas de prendas', color: COLOR_SALES, values: data.months.map(m => m.revenue) },
          { name: 'Utilidad neta', color: COLOR_PROFIT, values: data.months.map(m => m.netProfit) },
        ];
        const withSales = data.months.filter(m => m.orders > 0);
        this.best = withSales.length ? withSales.reduce((a, b) => (b.netProfit > a.netProfit ? b : a)) : null;
      },
      error: () => { this.error = 'No se pudo cargar el cierre mensual'; },
    });
  }
}
