import { Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { CurrencyPipe } from '@angular/common';
import { ApiService } from '../../services/api.service';
import { CartService } from '../../services/cart.service';
import { OrderSummary } from '../../models/types';

@Component({
    selector: 'app-order-result',
    imports: [RouterLink, CurrencyPipe],
    template: `
    <div class="max-w-xl mx-auto px-4 py-16 text-center">
      @if (notFound) {
        <h1 class="font-display text-2xl font-bold text-nova-dark mb-4">No encontramos este pedido</h1>
        <a routerLink="/catalogo" class="underline text-nova-dark">Volver a la tienda</a>
      } @else if (order) {
        @switch (order.status) {
          @case ('APPROVED') {
            <div class="w-14 h-14 rounded-full bg-green-100 text-green-700 flex items-center justify-center mx-auto mb-4 text-2xl">✓</div>
            <h1 class="font-display text-2xl font-bold text-nova-dark mb-2">¡Gracias por tu compra, {{ order.customerName }}!</h1>
            <p class="text-nova-gray mb-6">Tu pago fue aprobado. Te escribiremos por WhatsApp o correo cuando tu pedido salga.</p>
          }
          @case ('PENDING') {
            <div class="w-14 h-14 rounded-full bg-nova-pink flex items-center justify-center mx-auto mb-4">
              <div class="w-6 h-6 border-2 border-nova-dark border-t-transparent rounded-full animate-spin"></div>
            </div>
            <h1 class="font-display text-2xl font-bold text-nova-dark mb-2">Estamos confirmando tu pago</h1>
            <p class="text-nova-gray mb-6">Esto puede tardar unos minutos (sobre todo con PSE). Puedes dejar esta página abierta.</p>
          }
          @default {
            <div class="w-14 h-14 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto mb-4 text-2xl">!</div>
            <h1 class="font-display text-2xl font-bold text-nova-dark mb-2">El pago no se completó</h1>
            <p class="text-nova-gray mb-6">
              {{ order.status === 'EXPIRED' ? 'El tiempo para pagar se agotó.' : 'La transacción fue rechazada o cancelada.' }}
              No se hizo ningún cobro. Tus prendas siguen en la bolsa para que lo intentes de nuevo.
            </p>
            <a routerLink="/carrito" class="inline-block bg-nova-dark text-white px-6 py-3 rounded-lg text-sm uppercase tracking-wider mb-6">Volver a la bolsa</a>
          }
        }

        @if (simulated) {
          <p class="inline-block bg-[#fff6db] text-[#6b5313] text-xs rounded-full px-3 py-1 mb-4">Pago simulado de prueba · no se cobró dinero</p>
        }
        <div class="border border-nova-blush rounded-lg p-5 text-left text-sm">
          <p class="text-nova-gray mb-3">Pedido <strong class="text-nova-dark">{{ order.reference }}</strong></p>
          @for (item of order.items; track $index) {
            <div class="flex justify-between gap-2 text-nova-gray mb-1">
              <span>{{ item.quantity }} × {{ item.productName }} ({{ item.size }})</span>
              <span>{{ item.unitPrice * item.quantity | currency:'COP':'$':'1.0-0' }}</span>
            </div>
          }
          @if (order.discountAmount) {
            <div class="flex justify-between text-green-700 mt-2"><span>Descuento ({{ order.discountCode }})</span><span>−{{ order.discountAmount | currency:'COP':'$':'1.0-0' }}</span></div>
          }
          <div class="flex justify-between text-nova-gray mt-2"><span>Envío</span><span>{{ order.shippingCost | currency:'COP':'$':'1.0-0' }}</span></div>
          <div class="flex justify-between font-semibold text-nova-dark border-t border-nova-blush pt-2 mt-2">
            <span>Total</span><span>{{ order.total | currency:'COP':'$':'1.0-0' }} COP</span>
          </div>
        </div>

        <a routerLink="/catalogo" class="inline-block text-sm underline text-nova-gray mt-6 hover:text-nova-rose">Seguir comprando</a>
      } @else {
        <p class="text-nova-gray">Cargando...</p>
      }
    </div>
  `
})
export class OrderResultComponent implements OnInit, OnDestroy {
  order: OrderSummary | null = null;
  notFound = false;
  simulated = false;
  private reference = '';
  private transactionId = '';
  private timer: ReturnType<typeof setTimeout> | null = null;
  private attempts = 0;

  constructor(private route: ActivatedRoute, private api: ApiService, private cart: CartService) {}

  ngOnInit() {
    this.reference = this.route.snapshot.paramMap.get('reference') || '';
    // Wompi agrega ?id=<id de la transacción> al volver
    this.transactionId = this.route.snapshot.queryParamMap.get('id') || '';
    this.simulated = this.transactionId.startsWith('SIM-');
    this.load();
  }

  ngOnDestroy() {
    if (this.timer) clearTimeout(this.timer);
  }

  private load() {
    this.api.getOrderStatus(this.reference, this.transactionId).subscribe({
      next: order => {
        this.order = order;
        if (order.status === 'APPROVED') this.cart.clear();
        // Mientras siga pendiente se vuelve a consultar (máx. ~10 minutos)
        if (order.status === 'PENDING' && this.attempts++ < 120) {
          this.timer = setTimeout(() => this.load(), 5000);
        }
      },
      error: () => { this.notFound = true; },
    });
  }
}
