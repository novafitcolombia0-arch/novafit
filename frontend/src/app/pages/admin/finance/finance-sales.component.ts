import { Component, Input, OnChanges, OnInit } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../../services/api.service';
import { CostRow, FinanceRange, Sale } from '../../../models/types';
import { CHANNEL_LABELS, PAYMENT_LABELS, label, money } from './finance-format';

interface SaleLine { productId: number | null; size: string; quantity: number; unitPrice: number | null; }

const today = () => new Date(Date.now() - 5 * 3600_000).toISOString().slice(0, 10);

@Component({
    selector: 'app-finance-sales',
    imports: [FormsModule, DatePipe],
    template: `
    @if (error) { <div class="bg-red-50 text-red-600 p-3 rounded mb-4 text-sm">{{ error }}</div> }

    <div class="flex flex-wrap items-center gap-3 mb-4">
      <p class="text-sm text-nova-gray">{{ activeSales().length }} ventas · {{ money(totalSales()) }} · utilidad bruta {{ money(totalProfit()) }}</p>
      <button (click)="toggleForm()" class="ml-auto bg-nova-dark text-white px-4 py-2 rounded text-sm">
        {{ showForm ? 'Cerrar' : '+ Registrar venta directa' }}
      </button>
    </div>

    @if (showForm) {
      <div class="bg-white border border-nova-blush rounded-lg p-5 mb-6">
        <h3 class="font-semibold text-nova-dark mb-1">Venta directa</h3>
        <p class="text-xs text-nova-gray mb-4">Para ventas por WhatsApp, en persona o en ferias. Descuenta el inventario y entra a los reportes.</p>
        <div class="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4 text-sm">
          <div><label class="block mb-1">Fecha</label><input type="date" [(ngModel)]="form.date" [max]="maxDate" class="inp"></div>
          <div><label class="block mb-1">Medio de pago *</label>
            <select [(ngModel)]="form.paymentMethod" class="inp">
              <option value="">Seleccionar...</option>
              @for (m of paymentMethods; track m) { <option [value]="m">{{ paymentLabel(m) }}</option> }
            </select>
          </div>
          <div><label class="block mb-1">Cliente</label><input [(ngModel)]="form.customerName" class="inp"></div>
          <div><label class="block mb-1">Celular</label><input [(ngModel)]="form.phone" class="inp"></div>
          <div><label class="block mb-1">Ciudad</label><input [(ngModel)]="form.city" class="inp"></div>
        </div>

        <div class="space-y-2 mb-3">
          @for (l of form.items; track l; let i = $index) {
            <div class="grid grid-cols-12 gap-2 items-end text-sm">
              <div class="col-span-12 md:col-span-4">
                @if (i === 0) { <label class="block mb-1">Prenda</label> }
                <select [(ngModel)]="l.productId" (ngModelChange)="onProduct(l)" class="inp">
                  <option [ngValue]="null">Seleccionar...</option>
                  @for (p of products; track p.id) { <option [ngValue]="p.id">{{ p.name }}</option> }
                </select>
              </div>
              <div class="col-span-4 md:col-span-2">
                @if (i === 0) { <label class="block mb-1">Talla</label> }
                <select [(ngModel)]="l.size" class="inp">
                  <option value="">—</option>
                  @for (s of sizesOf(l.productId); track s.size) {
                    <option [value]="s.size" [disabled]="s.stock <= 0">{{ s.size }} ({{ s.stock }})</option>
                  }
                </select>
              </div>
              <div class="col-span-3 md:col-span-1">
                @if (i === 0) { <label class="block mb-1">Cant.</label> }
                <input type="number" min="1" [(ngModel)]="l.quantity" class="inp">
              </div>
              <div class="col-span-5 md:col-span-2">
                @if (i === 0) { <label class="block mb-1">Precio unit.</label> }
                <input type="number" min="0" [(ngModel)]="l.unitPrice" class="inp">
              </div>
              <div class="col-span-10 md:col-span-2 text-xs text-nova-gray pb-2">
                @if (lineProfit(l); as p) { Utilidad: <span [class.text-red-600]="p < 0">{{ money(p) }}</span> }
              </div>
              <div class="col-span-2 md:col-span-1 pb-1">
                @if (form.items.length > 1) { <button (click)="form.items.splice(i, 1)" class="text-red-500 text-xs">Quitar</button> }
              </div>
            </div>
          }
        </div>
        <button (click)="addLine()" class="text-sm underline text-nova-dark mb-4">+ Otra prenda</button>

        <div class="flex flex-wrap items-end gap-4 border-t border-nova-blush pt-4 text-sm">
          <div><label class="block mb-1">Envío cobrado</label><input type="number" min="0" [(ngModel)]="form.shippingCost" class="inp w-32"></div>
          <div class="flex-1 min-w-[200px]"><label class="block mb-1">Nota</label><input [(ngModel)]="form.notes" class="inp"></div>
          <p class="font-semibold text-nova-dark">Total: {{ money(formTotal()) }}</p>
          <button (click)="save()" [disabled]="saving" class="bg-nova-dark text-white px-5 py-2 rounded disabled:opacity-50">
            {{ saving ? 'Guardando...' : 'Guardar venta' }}
          </button>
        </div>
        @if (formError) { <p class="text-red-600 text-sm mt-2">{{ formError }}</p> }
      </div>
    }

    <div class="bg-white border border-nova-blush rounded-lg overflow-x-auto">
      <table class="w-full text-sm">
        <thead class="bg-nova-cream text-nova-gray">
          <tr>
            <th class="text-left px-3 py-2 font-medium">Fecha</th>
            <th class="text-left px-3 py-2 font-medium">Canal</th>
            <th class="text-left px-3 py-2 font-medium">Cliente</th>
            <th class="text-left px-3 py-2 font-medium">Prendas</th>
            <th class="text-left px-3 py-2 font-medium">Pago</th>
            <th class="text-right px-3 py-2 font-medium">Total</th>
            <th class="text-right px-3 py-2 font-medium">Costo</th>
            <th class="text-right px-3 py-2 font-medium">Utilidad bruta</th>
            <th class="px-3 py-2"></th>
          </tr>
        </thead>
        <tbody>
          @for (s of sales; track s.id) {
            <tr class="border-t border-nova-pink align-top" [class.opacity-50]="s.status !== 'APPROVED' || s.fulfillmentStatus === 'CANCELADO'">
              <td class="px-3 py-2 whitespace-nowrap text-nova-gray">{{ s.paidAt | date:'dd/MM/yy HH:mm' }}</td>
              <td class="px-3 py-2 whitespace-nowrap">{{ channelLabel(s.channel) }}
                @if (s.status === 'VOIDED') { <span class="text-red-600 text-xs block">Anulada</span> }
                @if (s.fulfillmentStatus === 'CANCELADO') { <span class="text-red-600 text-xs block">Cancelada</span> }
              </td>
              <td class="px-3 py-2">{{ s.customerName }}<span class="block text-xs text-nova-gray">{{ s.city }}</span></td>
              <td class="px-3 py-2">
                @for (i of s.items; track $index) {
                  <span class="block">{{ i.quantity }} × {{ i.productName }} ({{ i.size }}) · {{ money(i.unitPrice) }}</span>
                }
              </td>
              <td class="px-3 py-2 whitespace-nowrap">{{ paymentLabel(s.paymentMethod || 'SIN DATO') }}</td>
              <td class="px-3 py-2 text-right whitespace-nowrap">{{ money(s.total) }}</td>
              <td class="px-3 py-2 text-right whitespace-nowrap">{{ money(s.cogs) }}@if (s.missingCost) { <span class="text-yellow-600" title="Hay prendas sin costo">*</span> }</td>
              <td class="px-3 py-2 text-right whitespace-nowrap font-medium">{{ money(s.grossProfit) }}</td>
              <td class="px-3 py-2 text-right">
                @if (s.channel === 'MANUAL' && s.status === 'APPROVED') {
                  <button (click)="voidSale(s)" class="text-xs text-red-600 hover:underline">Anular</button>
                }
              </td>
            </tr>
          } @empty {
            <tr><td colspan="9" class="px-3 py-12 text-center text-nova-gray">{{ loading ? 'Cargando...' : 'No hay ventas en estas fechas' }}</td></tr>
          }
        </tbody>
      </table>
    </div>
    <p class="text-xs text-nova-gray mt-2">* Venta con prendas sin costo registrado: la utilidad real es menor.</p>
  `,
    styles: [`.inp { @apply w-full border border-nova-blush rounded px-2 py-1.5 bg-white focus:outline-none focus:border-nova-rose; }`]
})
export class FinanceSalesComponent implements OnInit, OnChanges {
  @Input({ required: true }) range!: FinanceRange;

  sales: Sale[] = [];
  products: CostRow[] = [];
  loading = false;
  error = '';
  showForm = false;
  saving = false;
  formError = '';
  maxDate = today();
  paymentMethods = ['EFECTIVO', 'TRANSFERENCIA', 'NEQUI', 'DAVIPLATA', 'DATAFONO', 'OTRO'];
  form = this.emptyForm();
  money = money;

  constructor(private api: ApiService) {}

  ngOnInit() { this.loadProducts(); }
  ngOnChanges() { this.load(); }

  load() {
    this.loading = true;
    this.api.getSales(this.range).subscribe({
      next: s => { this.sales = s; this.loading = false; },
      error: () => { this.error = 'No se pudieron cargar las ventas'; this.loading = false; },
    });
  }

  loadProducts() {
    this.api.getCosts().subscribe(p => (this.products = p.filter(x => x.isActive || x.stock > 0)));
  }

  activeSales() { return this.sales.filter(s => s.status === 'APPROVED' && s.fulfillmentStatus !== 'CANCELADO'); }
  totalSales() { return this.activeSales().reduce((t, s) => t + s.total, 0); }
  totalProfit() { return this.activeSales().reduce((t, s) => t + s.grossProfit, 0); }

  channelLabel(c: string) { return label(CHANNEL_LABELS, c); }
  paymentLabel(m: string) { return label(PAYMENT_LABELS, m); }

  toggleForm() {
    this.showForm = !this.showForm;
    if (this.showForm) { this.form = this.emptyForm(); this.formError = ''; this.loadProducts(); }
  }

  emptyForm() {
    return {
      date: today(), paymentMethod: '', customerName: '', phone: '', city: '', notes: '',
      shippingCost: 0, items: [{ productId: null, size: '', quantity: 1, unitPrice: null }] as SaleLine[],
    };
  }

  addLine() { this.form.items.push({ productId: null, size: '', quantity: 1, unitPrice: null }); }

  sizesOf(id: number | null) { return this.products.find(p => p.id === id)?.sizes || []; }

  onProduct(l: SaleLine) {
    const p = this.products.find(x => x.id === l.productId);
    l.size = '';
    l.unitPrice = p ? p.price : null;
  }

  lineProfit(l: SaleLine): number | null {
    const p = this.products.find(x => x.id === l.productId);
    if (!p || p.cost === null || l.unitPrice === null) return null;
    return (l.unitPrice - p.cost) * (l.quantity || 0);
  }

  formTotal() {
    return this.form.items.reduce((t, l) => t + (l.unitPrice || 0) * (l.quantity || 0), 0) + (Number(this.form.shippingCost) || 0);
  }

  save() {
    this.formError = '';
    if (!this.form.paymentMethod) { this.formError = 'Selecciona el medio de pago'; return; }
    if (this.form.items.some(l => !l.productId || !l.size || !(l.quantity > 0) || l.unitPrice === null)) {
      this.formError = 'Completa prenda, talla, cantidad y precio en cada línea';
      return;
    }
    this.saving = true;
    this.api.createSale(this.form).subscribe({
      next: () => {
        this.saving = false;
        this.showForm = false;
        this.load();
        this.loadProducts();
      },
      error: err => { this.saving = false; this.formError = err?.error?.message || 'No se pudo guardar la venta'; },
    });
  }

  voidSale(s: Sale) {
    const reason = prompt(`¿Anular la venta de ${s.customerName} por ${money(s.total)}? Las prendas vuelven al inventario.\n\nMotivo (opcional):`);
    if (reason === null) return;
    this.api.voidSale(s.id, reason).subscribe({
      next: () => { this.load(); this.loadProducts(); },
      error: err => { this.error = err?.error?.message || 'No se pudo anular'; },
    });
  }
}
