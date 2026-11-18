import { Component, OnInit } from '@angular/core';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../../services/api.service';
import { Order } from '../../../models/types';

const STATUS_LABELS: Record<string, string> = {
  APPROVED: 'Pagado',
  PENDING: 'Pendiente de pago',
  DECLINED: 'Rechazado',
  VOIDED: 'Anulado',
  ERROR: 'Error',
  EXPIRED: 'Expirado',
};

const FULFILLMENT_LABELS: Record<string, string> = {
  POR_DESPACHAR: 'Por despachar',
  DESPACHADO: 'Despachado',
  ENTREGADO: 'Entregado',
  CANCELADO: 'Cancelado',
};

const METHOD_LABELS: Record<string, string> = {
  CARD: 'Tarjeta',
  PSE: 'PSE',
  NEQUI: 'Nequi',
  BANCOLOMBIA_TRANSFER: 'Botón Bancolombia',
  BANCOLOMBIA_QR: 'QR Bancolombia',
  BANCOLOMBIA_COLLECT: 'Corresponsal Bancolombia',
  DAVIPLATA: 'Daviplata',
};

type SortKey = 'createdAt' | 'total';

@Component({
    selector: 'app-admin-orders',
    imports: [CurrencyPipe, DatePipe, FormsModule],
    template: `
    <div class="w-full">
      <div class="flex flex-wrap items-end justify-between gap-4 mb-6">
        <h1 class="font-display text-3xl font-bold text-nova-dark">Pedidos</h1>
        <p class="text-sm text-nova-gray">
          {{ filtered.length }} de {{ orders.length }} pedidos
          @if (filteredPaidTotal > 0) { · pagado {{ filteredPaidTotal | currency:'COP':'$':'1.0-0' }} }
        </p>
      </div>

      <!-- Filtros -->
      <div class="bg-white border border-nova-blush rounded-lg p-4 mb-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 text-sm">
        <input [(ngModel)]="search" (ngModelChange)="page = 1" placeholder="Buscar referencia, cliente, teléfono, ciudad o guía"
               class="lg:col-span-2 border border-nova-blush rounded px-3 py-2">
        <select [(ngModel)]="statusFilter" (ngModelChange)="page = 1" class="border border-nova-blush rounded px-3 py-2 bg-white" aria-label="Estado del pago">
          <option value="">Pago: todos</option>
          @for (s of statusOptions; track s) { <option [value]="s">{{ statusLabel(s) }}</option> }
        </select>
        <select [(ngModel)]="fulfillmentFilter" (ngModelChange)="page = 1" class="border border-nova-blush rounded px-3 py-2 bg-white" aria-label="Estado del envío">
          <option value="">Envío: todos</option>
          @for (f of fulfillmentOptions; track f) { <option [value]="f">{{ fulfillmentLabel(f) }}</option> }
        </select>
        <select [(ngModel)]="methodFilter" (ngModelChange)="page = 1" class="border border-nova-blush rounded px-3 py-2 bg-white" aria-label="Medio de pago">
          <option value="">Medio: todos</option>
          @for (m of methodOptions; track m) { <option [value]="m">{{ methodLabel(m) }}</option> }
        </select>
        <button (click)="clearFilters()" [disabled]="!hasFilters"
                class="border border-nova-blush rounded px-3 py-2 text-nova-dark hover:bg-nova-pink disabled:opacity-40 disabled:cursor-not-allowed">
          Limpiar filtros
        </button>
        <label class="flex items-center gap-2 text-nova-gray">
          Desde <input type="date" [(ngModel)]="dateFrom" (ngModelChange)="page = 1" class="flex-1 border border-nova-blush rounded px-2 py-1.5">
        </label>
        <label class="flex items-center gap-2 text-nova-gray">
          Hasta <input type="date" [(ngModel)]="dateTo" (ngModelChange)="page = 1" class="flex-1 border border-nova-blush rounded px-2 py-1.5">
        </label>
      </div>

      @if (error) { <div class="bg-red-50 text-red-600 p-3 rounded mb-4 text-sm">{{ error }}</div> }

      <div class="bg-white border border-nova-blush rounded-lg overflow-x-auto">
        <table class="w-full text-sm">
          <thead class="bg-nova-pink text-nova-dark text-left">
            <tr>
              <th class="px-3 py-2.5 font-semibold">Referencia</th>
              <th class="px-3 py-2.5 font-semibold">
                <button (click)="sortBy('createdAt')" class="hover:underline">Fecha {{ sortIcon('createdAt') }}</button>
              </th>
              <th class="px-3 py-2.5 font-semibold">Cliente</th>
              <th class="px-3 py-2.5 font-semibold">Ciudad</th>
              <th class="px-3 py-2.5 font-semibold text-center">Prendas</th>
              <th class="px-3 py-2.5 font-semibold text-right">
                <button (click)="sortBy('total')" class="hover:underline">Total {{ sortIcon('total') }}</button>
              </th>
              <th class="px-3 py-2.5 font-semibold">Pago</th>
              <th class="px-3 py-2.5 font-semibold">Medio</th>
              <th class="px-3 py-2.5 font-semibold">Envío</th>
              <th class="px-3 py-2.5 font-semibold">Guía</th>
            </tr>
          </thead>
          <tbody>
            @if (loading) {
              <tr><td colspan="10" class="px-4 py-12 text-center text-nova-gray">Cargando pedidos…</td></tr>
            } @else if (filtered.length === 0) {
              <tr><td colspan="10" class="px-4 py-12 text-center text-nova-gray">
                {{ orders.length ? 'Ningún pedido coincide con los filtros.' : 'Todavía no hay pedidos.' }}
              </td></tr>
            }
            @for (o of paged; track o.id) {
              <tr (click)="toggle(o.id)" class="border-t border-nova-blush cursor-pointer hover:bg-nova-pink/40"
                  [class.bg-nova-pink]="openId === o.id">
                <td class="px-3 py-2.5 font-medium text-nova-dark whitespace-nowrap">{{ o.reference }}</td>
                <td class="px-3 py-2.5 text-nova-gray whitespace-nowrap">{{ o.createdAt | date:'dd/MM/yyyy HH:mm' }}</td>
                <td class="px-3 py-2.5">
                  <span class="text-nova-dark whitespace-nowrap">{{ o.customerName }}</span>
                  <span class="block text-xs text-nova-gray">{{ o.phone }}</span>
                </td>
                <td class="px-3 py-2.5 text-nova-gray">{{ o.city }}</td>
                <td class="px-3 py-2.5 text-center text-nova-gray">{{ itemCount(o) }}</td>
                <td class="px-3 py-2.5 text-right font-medium text-nova-dark whitespace-nowrap">{{ o.total | currency:'COP':'$':'1.0-0' }}</td>
                <td class="px-3 py-2.5"><span class="px-2 py-0.5 rounded text-xs whitespace-nowrap" [class]="statusClass(o.status)">{{ statusLabel(o.status) }}</span></td>
                <td class="px-3 py-2.5 text-nova-gray whitespace-nowrap">{{ o.paymentMethod ? methodLabel(o.paymentMethod) : '—' }}</td>
                <td class="px-3 py-2.5">
                  @if (o.status === 'APPROVED') {
                    <span class="px-2 py-0.5 rounded text-xs whitespace-nowrap" [class]="fulfillmentClass(o.fulfillmentStatus)">{{ fulfillmentLabel(o.fulfillmentStatus) }}</span>
                  } @else { <span class="text-nova-gray">—</span> }
                </td>
                <td class="px-3 py-2.5 text-nova-gray whitespace-nowrap">{{ o.trackingNumber || '—' }}</td>
              </tr>

              @if (openId === o.id) {
                <tr class="border-t border-nova-blush bg-white">
                  <td colspan="10" class="px-4 py-5">
                    <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div>
                        <h3 class="font-semibold text-nova-dark mb-2">Prendas</h3>
                        @for (item of o.items; track item.id) {
                          <p class="text-nova-gray">{{ item.quantity }} × {{ item.productName }} — talla {{ item.size }}
                            <span class="text-nova-dark">({{ item.unitPrice * item.quantity | currency:'COP':'$':'1.0-0' }})</span></p>
                        }
                        @if (o.discountAmount) {
                          <p class="text-green-700 mt-2">Descuento {{ o.discountCode }}: −{{ o.discountAmount | currency:'COP':'$':'1.0-0' }}</p>
                        }
                        <p class="text-nova-gray" [class.mt-2]="!o.discountAmount">Envío: {{ o.shippingCost | currency:'COP':'$':'1.0-0' }}</p>
                        @if (o.paidAt) { <p class="text-nova-gray">Pagado el {{ o.paidAt | date:'dd/MM/yyyy HH:mm' }}</p> }
                        @if (o.wompiTransactionId) { <p class="text-nova-gray text-xs mt-1">Transacción Wompi: {{ o.wompiTransactionId }}</p> }
                      </div>
                      <div>
                        <h3 class="font-semibold text-nova-dark mb-2">Cliente y envío</h3>
                        <p class="text-nova-gray">{{ o.customerName }} @if (o.documentId) { · CC {{ o.documentId }} }</p>
                        <p class="text-nova-gray">
                          <a [href]="'https://wa.me/57' + o.phone" target="_blank" rel="noopener" class="underline" (click)="$event.stopPropagation()">{{ o.phone }}</a>
                          · {{ o.email }}
                        </p>
                        <p class="text-nova-gray mt-1">{{ o.address }}</p>
                        <p class="text-nova-gray">{{ o.city }}, {{ o.department }}</p>
                        @if (o.notes) { <p class="text-nova-gray mt-1 italic">"{{ o.notes }}"</p> }
                      </div>
                      @if (o.status === 'APPROVED') {
                        <div>
                          <h3 class="font-semibold text-nova-dark mb-2">Despacho</h3>
                          <select [(ngModel)]="o.fulfillmentStatus" class="w-full border border-nova-blush rounded px-3 py-2 mb-2 bg-white">
                            @for (f of fulfillmentOptions; track f) { <option [value]="f">{{ fulfillmentLabel(f) }}</option> }
                          </select>
                          <input [(ngModel)]="o.trackingNumber" placeholder="Número de guía"
                                 class="w-full border border-nova-blush rounded px-3 py-2 mb-2">
                          <button (click)="saveFulfillment(o)" class="bg-nova-dark text-white px-4 py-2 rounded text-sm">Guardar</button>
                          @if (savedId === o.id) { <span class="text-green-700 text-xs ml-2">Guardado</span> }
                        </div>
                      }
                    </div>
                  </td>
                </tr>
              }
            }
          </tbody>
        </table>
      </div>

      @if (filtered.length > pageSize) {
        <nav class="flex flex-wrap items-center justify-between gap-3 mt-4 text-sm" aria-label="Paginación de pedidos">
          <p class="text-nova-gray">Mostrando {{ rangeStart }}–{{ rangeEnd }} de {{ filtered.length }}</p>
          <div class="flex items-center gap-1">
            <button (click)="goTo(currentPage - 1)" [disabled]="currentPage === 1"
                    class="px-3 py-1.5 rounded border border-nova-blush bg-white text-nova-dark hover:bg-nova-pink disabled:opacity-40 disabled:cursor-not-allowed">‹ Anterior</button>
            @for (p of pageNumbers; track $index) {
              @if (p === null) {
                <span class="px-2 text-nova-gray">…</span>
              } @else {
                <button (click)="goTo(p)" [attr.aria-current]="p === currentPage ? 'page' : null"
                        class="min-w-[2.25rem] px-2 py-1.5 rounded border"
                        [class]="p === currentPage ? 'bg-nova-dark text-white border-nova-dark' : 'bg-white text-nova-dark border-nova-blush hover:bg-nova-pink'">{{ p }}</button>
              }
            }
            <button (click)="goTo(currentPage + 1)" [disabled]="currentPage === totalPages"
                    class="px-3 py-1.5 rounded border border-nova-blush bg-white text-nova-dark hover:bg-nova-pink disabled:opacity-40 disabled:cursor-not-allowed">Siguiente ›</button>
          </div>
        </nav>
      }
    </div>
  `
})
export class AdminOrdersComponent implements OnInit {
  orders: Order[] = [];
  openId: number | null = null;
  savedId: number | null = null;
  loading = false;
  error = '';

  search = '';
  statusFilter = 'APPROVED';
  fulfillmentFilter = '';
  methodFilter = '';
  dateFrom = '';
  dateTo = '';
  sortKey: SortKey = 'createdAt';
  sortDesc = true;
  page = 1;
  readonly pageSize = 10;

  statusOptions = Object.keys(STATUS_LABELS);
  fulfillmentOptions = Object.keys(FULFILLMENT_LABELS);

  constructor(private api: ApiService) {}

  ngOnInit() { this.load(); }

  // Se cargan todos los pedidos una vez; los filtros se aplican aquí para que respondan al instante
  load() {
    this.loading = true;
    this.error = '';
    this.api.getOrders().subscribe({
      next: orders => { this.orders = orders; this.loading = false; },
      error: () => { this.error = 'No se pudieron cargar los pedidos'; this.loading = false; },
    });
  }

  get methodOptions(): string[] {
    return [...new Set(this.orders.map(o => o.paymentMethod).filter((m): m is string => !!m))].sort();
  }

  get hasFilters() {
    return !!(this.search || this.statusFilter || this.fulfillmentFilter || this.methodFilter || this.dateFrom || this.dateTo);
  }

  get filtered(): Order[] {
    const q = this.search.trim().toLowerCase();
    const from = this.dateFrom ? new Date(`${this.dateFrom}T00:00:00`).getTime() : null;
    const to = this.dateTo ? new Date(`${this.dateTo}T23:59:59.999`).getTime() : null;
    return this.orders
      .filter(o => {
        if (this.statusFilter && o.status !== this.statusFilter) return false;
        if (this.fulfillmentFilter && (o.status !== 'APPROVED' || o.fulfillmentStatus !== this.fulfillmentFilter)) return false;
        if (this.methodFilter && o.paymentMethod !== this.methodFilter) return false;
        const created = new Date(o.createdAt).getTime();
        if (from !== null && created < from) return false;
        if (to !== null && created > to) return false;
        if (q) {
          const haystack = [o.reference, o.customerName, o.email, o.phone, o.city, o.department, o.trackingNumber, o.documentId]
            .filter(Boolean).join(' ').toLowerCase();
          if (!haystack.includes(q)) return false;
        }
        return true;
      })
      .sort((a, b) => {
        const va = this.sortKey === 'total' ? a.total : new Date(a.createdAt).getTime();
        const vb = this.sortKey === 'total' ? b.total : new Date(b.createdAt).getTime();
        return this.sortDesc ? vb - va : va - vb;
      });
  }

  get totalPages(): number { return Math.max(1, Math.ceil(this.filtered.length / this.pageSize)); }

  // La página nunca queda fuera de rango (p. ej. si un filtro deja menos resultados)
  get currentPage(): number { return Math.min(Math.max(1, this.page), this.totalPages); }

  get paged(): Order[] {
    const start = (this.currentPage - 1) * this.pageSize;
    return this.filtered.slice(start, start + this.pageSize);
  }

  get rangeStart() { return this.filtered.length ? (this.currentPage - 1) * this.pageSize + 1 : 0; }
  get rangeEnd() { return Math.min(this.currentPage * this.pageSize, this.filtered.length); }

  // Números de página con "…" cuando hay muchas: 1 … 4 5 6 … 20
  get pageNumbers(): (number | null)[] {
    const total = this.totalPages, current = this.currentPage;
    if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
    const pages: (number | null)[] = [1];
    const from = Math.max(2, current - 1), to = Math.min(total - 1, current + 1);
    if (from > 2) pages.push(null);
    for (let p = from; p <= to; p++) pages.push(p);
    if (to < total - 1) pages.push(null);
    pages.push(total);
    return pages;
  }

  goTo(page: number) {
    this.page = Math.min(Math.max(1, page), this.totalPages);
    this.openId = null;
  }

  get filteredPaidTotal(): number {
    return this.filtered.filter(o => o.status === 'APPROVED').reduce((sum, o) => sum + o.total, 0);
  }

  clearFilters() {
    this.search = '';
    this.statusFilter = '';
    this.fulfillmentFilter = '';
    this.methodFilter = '';
    this.dateFrom = '';
    this.dateTo = '';
    this.page = 1;
  }

  sortBy(key: SortKey) {
    if (this.sortKey === key) this.sortDesc = !this.sortDesc;
    else { this.sortKey = key; this.sortDesc = true; }
    this.page = 1;
  }

  sortIcon(key: SortKey) { return this.sortKey === key ? (this.sortDesc ? '↓' : '↑') : ''; }

  toggle(id: number) { this.openId = this.openId === id ? null : id; }

  itemCount(o: Order) { return o.items?.reduce((sum, i) => sum + i.quantity, 0) ?? 0; }

  saveFulfillment(o: Order) {
    this.savedId = null;
    this.api.updateOrder(o.id, { fulfillmentStatus: o.fulfillmentStatus, trackingNumber: o.trackingNumber || '' }).subscribe({
      next: () => { this.savedId = o.id; },
      error: () => { this.error = 'No se pudo guardar el despacho'; },
    });
  }

  statusLabel(s: string) { return STATUS_LABELS[s] || s; }
  fulfillmentLabel(s: string) { return FULFILLMENT_LABELS[s] || s; }
  methodLabel(m: string) { return METHOD_LABELS[m] || m; }

  statusClass(s: string) {
    if (s === 'APPROVED') return 'bg-green-100 text-green-700';
    if (s === 'PENDING') return 'bg-yellow-100 text-yellow-700';
    return 'bg-red-50 text-red-600';
  }

  fulfillmentClass(s: string) {
    if (s === 'ENTREGADO') return 'bg-green-100 text-green-700';
    if (s === 'DESPACHADO') return 'bg-blue-50 text-blue-700';
    if (s === 'CANCELADO') return 'bg-red-50 text-red-600';
    return 'bg-nova-pink text-nova-dark';
  }
}
