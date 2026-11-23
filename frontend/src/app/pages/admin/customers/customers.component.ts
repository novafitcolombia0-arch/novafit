import { Component, OnInit } from '@angular/core';
import { DatePipe, DecimalPipe, PercentPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../../services/api.service';
import { Customer, CustomersReport } from '../../../models/types';
import { money } from '../finance/finance-format';

type Filter = 'all' | 'repeat' | 'once' | 'inactive';

@Component({
  selector: 'app-admin-customers',
  imports: [FormsModule, DatePipe, DecimalPipe, PercentPipe],
  template: `
    <div class="w-full">
      <h1 class="font-display text-3xl font-bold text-nova-dark mb-2">Clientes</h1>
      <p class="text-sm text-nova-gray mb-6">Quién compra y quién vuelve a comprar. Cuenta las compras pagadas de la tienda web y las ventas directas, y une a la misma clienta por celular (o por correo si no hay celular).</p>

      @if (error) { <div class="bg-red-50 text-red-600 p-3 rounded mb-4 text-sm">{{ error }}</div> }

      @if (report) {
        <div class="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
          <div class="kpi"><p class="kpi-label">Clientes</p><p class="kpi-value">{{ report.summary.customers | number }}</p></div>
          <div class="kpi"><p class="kpi-label">Volvieron a comprar</p><p class="kpi-value">{{ report.summary.repeatCustomers | number }}</p>
            <p class="text-xs text-nova-gray">{{ report.summary.repeatRate | percent:'1.0-0' }} de las clientas</p></div>
          <div class="kpi"><p class="kpi-label">Compras por clienta</p><p class="kpi-value">{{ report.summary.avgOrders | number:'1.1-1' }}</p></div>
          <div class="kpi"><p class="kpi-label">Ventas de clientas que repiten</p><p class="kpi-value">{{ report.summary.repeatRevenueShare | percent:'1.0-0' }}</p></div>
          <div class="kpi"><p class="kpi-label">Días entre compras</p><p class="kpi-value">{{ report.summary.avgDaysBetween ?? '—' }}</p>
            <p class="text-xs text-nova-gray">promedio de quienes repiten</p></div>
        </div>

        <div class="flex flex-wrap items-center gap-3 mb-4 text-sm">
          <input [(ngModel)]="search" placeholder="Buscar por nombre, celular, correo o ciudad..." class="border border-nova-blush rounded px-3 py-2 w-full md:w-80 bg-white">
          <div class="flex flex-wrap gap-1">
            @for (f of filters; track f.id) {
              <button (click)="filter = f.id" class="px-3 py-1.5 rounded-full border transition"
                      [class.bg-nova-dark]="filter === f.id" [class.text-white]="filter === f.id" [class.border-nova-dark]="filter === f.id"
                      [class.border-nova-blush]="filter !== f.id">{{ f.label }}</button>
            }
          </div>
          @if (filter === 'inactive') {
            <label class="flex items-center gap-2 text-nova-gray">sin comprar hace más de
              <input type="number" min="1" [(ngModel)]="inactiveDays" class="w-16 border border-nova-blush rounded px-2 py-1"> días</label>
          }
          <button (click)="exportCsv()" class="ml-auto underline text-nova-dark hover:text-nova-rose">Descargar CSV</button>
        </div>

        <div class="bg-white border border-nova-blush rounded-lg overflow-x-auto">
          <table class="w-full text-sm">
            <thead class="bg-nova-cream text-nova-gray">
              <tr>
                <th class="text-left px-4 py-3 font-medium">Clienta</th>
                <th class="text-left px-4 py-3 font-medium">Contacto</th>
                <th class="text-right px-4 py-3 font-medium">Compras</th>
                <th class="text-right px-4 py-3 font-medium">Prendas</th>
                <th class="text-right px-4 py-3 font-medium">Total comprado</th>
                <th class="text-left px-4 py-3 font-medium">Primera / última compra</th>
                <th class="text-right px-4 py-3 font-medium">Días sin comprar</th>
              </tr>
            </thead>
            <tbody>
              @for (c of visible(); track c.key) {
                <tr class="border-t border-nova-pink align-top cursor-pointer hover:bg-nova-cream" (click)="open = open === c.key ? null : c.key">
                  <td class="px-4 py-3">
                    <p class="font-medium text-nova-dark">{{ c.name }}</p>
                    <p class="text-xs text-nova-gray">{{ c.city || '—' }} · {{ channels(c) }}</p>
                  </td>
                  <td class="px-4 py-3 text-xs text-nova-gray">
                    @if (c.phone) { <a [href]="'tel:' + c.phone" (click)="$event.stopPropagation()" class="block hover:underline">{{ c.phone }}</a> }
                    @if (c.email) { <a [href]="'mailto:' + c.email" (click)="$event.stopPropagation()" class="block hover:underline">{{ c.email }}</a> }
                  </td>
                  <td class="px-4 py-3 text-right">
                    <span class="font-semibold" [class.text-green-700]="c.orders > 1">{{ c.orders }}</span>
                    @if (c.orders > 1) { <span class="block text-[11px] text-green-700">recompra</span> }
                  </td>
                  <td class="px-4 py-3 text-right">{{ c.units }}</td>
                  <td class="px-4 py-3 text-right font-medium text-nova-dark whitespace-nowrap">{{ money(c.total) }}</td>
                  <td class="px-4 py-3 text-xs text-nova-gray whitespace-nowrap">{{ c.firstAt | date:'dd/MM/yy' }} → {{ c.lastAt | date:'dd/MM/yy' }}
                    @if (c.avgDaysBetween !== null) { <span class="block">cada {{ c.avgDaysBetween }} días en promedio</span> }
                  </td>
                  <td class="px-4 py-3 text-right" [class.text-red-600]="c.daysSinceLast > inactiveDays">{{ c.daysSinceLast }}</td>
                </tr>
                @if (open === c.key) {
                  <tr class="bg-nova-cream">
                    <td colspan="7" class="px-4 py-3">
                      <p class="text-xs font-medium text-nova-dark mb-2">Historial de compras</p>
                      @for (h of c.history; track h.reference) {
                        <p class="text-xs text-nova-gray mb-1">
                          <span class="text-nova-dark">{{ h.date | date:'dd/MM/yy' }}</span> · {{ h.channel === 'WEB' ? 'Web' : 'Directa' }} · {{ h.reference }} ·
                          <strong class="text-nova-dark">{{ money(h.total) }}</strong> — {{ h.items }}
                        </p>
                      }
                    </td>
                  </tr>
                }
              } @empty {
                <tr><td colspan="7" class="px-4 py-12 text-center text-nova-gray">No hay clientas con ese filtro</td></tr>
              }
            </tbody>
          </table>
        </div>
      } @else if (!error) {
        <p class="text-nova-gray">Cargando...</p>
      }
    </div>
  `,
  styles: [`
    .kpi { @apply bg-white border border-nova-blush rounded-lg p-4; }
    .kpi-label { @apply text-xs text-nova-gray uppercase tracking-wider; }
    .kpi-value { @apply text-2xl font-bold text-nova-dark; }
  `],
})
export class AdminCustomersComponent implements OnInit {
  report: CustomersReport | null = null;
  error = '';
  search = '';
  filter: Filter = 'all';
  inactiveDays = 60;
  open: string | null = null;
  money = money;

  filters: { id: Filter; label: string }[] = [
    { id: 'all', label: 'Todas' },
    { id: 'repeat', label: 'Volvieron a comprar' },
    { id: 'once', label: 'Una sola compra' },
    { id: 'inactive', label: 'Hace tiempo no compran' },
  ];

  constructor(private api: ApiService) {}

  ngOnInit() {
    this.api.getCustomers().subscribe({
      next: r => (this.report = r),
      error: () => (this.error = 'No se pudo cargar la lista de clientes'),
    });
  }

  channels(c: Customer) {
    return c.channels.map(ch => (ch === 'WEB' ? 'Web' : 'Directa')).join(' y ');
  }

  visible(): Customer[] {
    const q = this.search.trim().toLowerCase();
    return (this.report?.customers || []).filter(c => {
      if (this.filter === 'repeat' && c.orders < 2) return false;
      if (this.filter === 'once' && c.orders !== 1) return false;
      if (this.filter === 'inactive' && c.daysSinceLast <= this.inactiveDays) return false;
      if (!q) return true;
      return [c.name, c.phone, c.email, c.city].some(v => (v || '').toLowerCase().includes(q));
    });
  }

  exportCsv() {
    const rows = [['Clienta', 'Celular', 'Correo', 'Ciudad', 'Compras', 'Prendas', 'Total comprado', 'Primera compra', 'Última compra', 'Días sin comprar']];
    for (const c of this.visible()) {
      rows.push([c.name, c.phone || '', c.email || '', c.city || '', String(c.orders), String(c.units), String(c.total),
        c.firstAt.slice(0, 10), c.lastAt.slice(0, 10), String(c.daysSinceLast)]);
    }
    const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(';')).join('\r\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `clientes-nova-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }
}
