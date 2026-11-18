import { Component, OnInit, computed, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CurrencyPipe } from '@angular/common';
import { CartService } from '../../services/cart.service';
import { ApiService } from '../../services/api.service';

@Component({
    selector: 'app-cart',
    imports: [RouterLink, CurrencyPipe],
    template: `
    <div class="max-w-5xl mx-auto px-4 py-8">
      <h1 class="font-display text-3xl font-bold mb-8 text-nova-dark">Tu bolsa</h1>

      @if (cart.items().length === 0) {
        <div class="text-center py-16">
          <p class="text-nova-gray mb-6">Tu bolsa está vacía.</p>
          <a routerLink="/catalogo" class="inline-block bg-nova-dark text-white px-6 py-3 rounded-lg text-sm uppercase tracking-wider hover:bg-nova-black transition">Ir a la tienda</a>
        </div>
      } @else {
        <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div class="lg:col-span-2 space-y-4">
            @for (item of cart.items(); track item.productId + item.size) {
              <div class="flex gap-4 border border-nova-blush rounded-lg p-3">
                <a [routerLink]="['/producto', item.slug]" class="w-20 h-24 bg-nova-pink rounded overflow-hidden shrink-0">
                  @if (item.image) { <img [src]="item.image" [alt]="item.name" class="w-full h-full object-cover"> }
                </a>
                <div class="flex-1 min-w-0">
                  <div class="flex justify-between gap-2">
                    <a [routerLink]="['/producto', item.slug]" class="font-medium text-sm text-nova-dark hover:text-nova-rose truncate">{{ item.name }}</a>
                    <button (click)="cart.remove(item.productId, item.size)" class="text-xs text-nova-gray hover:text-red-600 shrink-0">Quitar</button>
                  </div>
                  <p class="text-xs text-nova-gray mt-1">Talla: {{ item.size }}</p>
                  <div class="flex items-center justify-between mt-3">
                    <div class="flex items-center border border-nova-blush rounded">
                      <button (click)="cart.setQuantity(item.productId, item.size, item.quantity - 1)" [disabled]="item.quantity <= 1"
                              class="w-8 h-8 text-nova-dark disabled:opacity-30">−</button>
                      <span class="w-8 text-center text-sm">{{ item.quantity }}</span>
                      <button (click)="cart.setQuantity(item.productId, item.size, item.quantity + 1)" [disabled]="item.quantity >= item.maxQuantity"
                              class="w-8 h-8 text-nova-dark disabled:opacity-30">+</button>
                    </div>
                    <p class="text-sm text-nova-dark">{{ item.price * item.quantity | currency:'COP':'$':'1.0-0' }}</p>
                  </div>
                </div>
              </div>
            }
          </div>

          <div class="border border-nova-blush rounded-lg p-5 h-fit">
            <h2 class="font-semibold text-nova-dark mb-4">Resumen</h2>
            <div class="flex justify-between text-sm text-nova-gray mb-2">
              <span>Subtotal</span><span>{{ cart.subtotal() | currency:'COP':'$':'1.0-0' }}</span>
            </div>
            <div class="flex justify-between text-sm text-nova-gray mb-4">
              <span>Envío</span>
              <span>{{ shipping() === 0 ? 'Gratis' : (shipping() | currency:'COP':'$':'1.0-0') }}</span>
            </div>
            <div class="flex justify-between font-semibold text-nova-dark border-t border-nova-blush pt-4 mb-5">
              <span>Total</span><span>{{ cart.subtotal() + shipping() | currency:'COP':'$':'1.0-0' }} COP</span>
            </div>
            @if (freeFrom() > 0 && cart.subtotal() < freeFrom()) {
              <p class="text-xs text-nova-gray mb-4">Te faltan {{ freeFrom() - cart.subtotal() | currency:'COP':'$':'1.0-0' }} para el envío gratis.</p>
            }
            <a routerLink="/checkout" class="block text-center w-full bg-nova-dark text-white py-3 rounded-lg font-medium text-sm uppercase tracking-wider hover:bg-nova-black transition">
              Continuar al pago
            </a>
            <a routerLink="/catalogo" class="block text-center text-sm text-nova-gray underline mt-3 hover:text-nova-rose">Seguir comprando</a>
          </div>
        </div>
      }
    </div>
  `
})
export class CartComponent implements OnInit {
  private shippingCost = signal(0);
  freeFrom = signal(0);
  shipping = computed(() =>
    this.freeFrom() > 0 && this.cart.subtotal() >= this.freeFrom() ? 0 : this.shippingCost()
  );

  constructor(public cart: CartService, private api: ApiService) {}

  ngOnInit() {
    this.api.getSettings().subscribe(s => {
      this.shippingCost.set(parseInt(s['shippingCost'] || '0', 10) || 0);
      this.freeFrom.set(parseInt(s['freeShippingFrom'] || '0', 10) || 0);
    });
  }
}
