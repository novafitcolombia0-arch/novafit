import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { CurrencyPipe } from '@angular/common';
import { ApiService } from '../../services/api.service';
import { OrderSummary } from '../../models/types';

/**
 * Pantalla de PRUEBA que reemplaza a Wompi cuando el backend corre con
 * WOMPI_SIMULATION=true. No cobra nada: solo decide si el pago sale aprobado o rechazado.
 */
@Component({
    selector: 'app-simulated-payment',
    imports: [CurrencyPipe, RouterLink],
    template: `
    <div class="min-h-[70vh] flex items-start justify-center px-4 py-12 bg-[#f4f3f0]">
      <div class="w-full max-w-md">
        <div class="bg-[#fff6db] border border-[#f0dca0] text-[#6b5313] rounded-xl px-4 py-3 text-sm mb-5">
          <strong>Pago simulado.</strong> Esta pantalla es solo para pruebas: no se cobra dinero ni se conecta con Wompi.
        </div>

        @if (error) {
          <div class="bg-[#fbeceb] text-[#b3372f] rounded-xl px-4 py-3 text-sm mb-5">{{ error }}</div>
        }

        @if (order) {
          <div class="bg-white rounded-2xl border border-[#e7e4df] p-6">
            <p class="text-sm text-[#6b6862]">Pedido {{ order.reference }}</p>
            <p class="text-[34px] font-bold tracking-tight mt-1">{{ order.total | currency:'COP':'$':'1.0-0' }}</p>
            <ul class="text-sm text-[#6b6862] mt-2 mb-6 space-y-0.5">
              @for (i of order.items; track $index) {
                <li>{{ i.quantity }} × {{ i.productName }} ({{ i.color ? i.color + ", " : "" }}{{ i.size }})</li>
              }
              @if (order.shippingCost) { <li>Envío {{ order.shippingCost | currency:'COP':'$':'1.0-0' }}</li> }
            </ul>

            @if (order.status === 'PENDING') {
              <p class="text-sm font-medium mb-2">Medio de pago</p>
              <div class="grid grid-cols-2 gap-2 mb-6">
                @for (m of methods; track m.id) {
                  <button type="button" (click)="method = m.id"
                          class="border rounded-lg px-3 py-2.5 text-sm text-left transition"
                          [class.border-[#1e1e1e]]="method === m.id" [class.bg-[#f7f6f3]]="method === m.id"
                          [class.border-[#e7e4df]]="method !== m.id">{{ m.label }}</button>
                }
              </div>

              <button (click)="pay('APPROVED')" [disabled]="processing"
                      class="w-full bg-[#1e1e1e] text-white rounded-lg py-3 font-semibold disabled:opacity-50">
                {{ processing ? 'Procesando pago…' : 'Simular pago aprobado' }}
              </button>
              <button (click)="pay('DECLINED')" [disabled]="processing"
                      class="w-full mt-2 border border-[#e7e4df] rounded-lg py-3 text-sm text-[#b3372f] disabled:opacity-50">
                Simular pago rechazado
              </button>
            } @else {
              <p class="text-sm text-[#6b6862] mb-4">Este pedido ya no está pendiente de pago.</p>
              <a [routerLink]="['/pedido', order.reference]" class="underline text-sm">Ver el estado del pedido</a>
            }
          </div>
        } @else if (!error) {
          <p class="text-center text-[#6b6862]">Cargando pedido…</p>
        }
      </div>
    </div>
  `
})
export class SimulatedPaymentComponent implements OnInit {
  order: OrderSummary | null = null;
  error = '';
  processing = false;
  method = 'CARD';
  methods = [
    { id: 'CARD', label: 'Tarjeta' },
    { id: 'PSE', label: 'PSE' },
    { id: 'NEQUI', label: 'Nequi' },
    { id: 'BANCOLOMBIA_TRANSFER', label: 'Botón Bancolombia' },
  ];
  private reference = '';

  constructor(private route: ActivatedRoute, private router: Router, private api: ApiService) {}

  ngOnInit() {
    this.reference = this.route.snapshot.paramMap.get('reference') || '';
    this.api.getOrderStatus(this.reference).subscribe({
      next: o => (this.order = o),
      error: () => (this.error = 'No encontramos este pedido.'),
    });
  }

  pay(status: 'APPROVED' | 'DECLINED') {
    this.processing = true;
    this.error = '';
    // Pequeña espera para que se sienta como un pago real
    setTimeout(() => {
      this.api.simulatePayment(this.reference, status, this.method).subscribe({
        next: res => this.router.navigate(['/pedido', this.reference], { queryParams: { id: res.transactionId } }),
        error: err => {
          this.processing = false;
          this.error = err?.error?.message || 'No se pudo simular el pago. ¿El backend tiene WOMPI_SIMULATION=true?';
        },
      });
    }, 1200);
  }
}
