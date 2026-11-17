import { Component, OnInit, computed, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { CurrencyPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CartService } from '../../services/cart.service';
import { ApiService } from '../../services/api.service';

const DEPARTMENTS = [
  'Amazonas', 'Antioquia', 'Arauca', 'Atlántico', 'Bogotá D.C.', 'Bolívar', 'Boyacá', 'Caldas',
  'Caquetá', 'Casanare', 'Cauca', 'Cesar', 'Chocó', 'Córdoba', 'Cundinamarca', 'Guainía',
  'Guaviare', 'Huila', 'La Guajira', 'Magdalena', 'Meta', 'Nariño', 'Norte de Santander',
  'Putumayo', 'Quindío', 'Risaralda', 'San Andrés y Providencia', 'Santander', 'Sucre',
  'Tolima', 'Valle del Cauca', 'Vaupés', 'Vichada',
];

@Component({
  selector: 'app-checkout',
  standalone: true,
  imports: [RouterLink, CurrencyPipe, FormsModule],
  template: `
    <div class="max-w-5xl mx-auto px-4 py-8">
      <h1 class="font-display text-3xl font-bold mb-8 text-nova-dark">Finalizar compra</h1>

      <form (ngSubmit)="pay()" #f="ngForm" class="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div class="lg:col-span-2 space-y-4">
          <h2 class="font-semibold text-nova-dark">Datos de contacto</h2>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div class="md:col-span-2">
              <label class="block text-sm mb-1">Nombre completo *</label>
              <input [(ngModel)]="form.name" name="name" required autocomplete="name" class="input">
            </div>
            <div>
              <label class="block text-sm mb-1">Correo electrónico *</label>
              <input [(ngModel)]="form.email" name="email" type="email" required email autocomplete="email" class="input">
            </div>
            <div>
              <label class="block text-sm mb-1">Celular *</label>
              <input [(ngModel)]="form.phone" name="phone" type="tel" required minlength="10" autocomplete="tel" placeholder="3001234567" class="input">
            </div>
            <div>
              <label class="block text-sm mb-1">Cédula</label>
              <input [(ngModel)]="form.documentId" name="documentId" inputmode="numeric" class="input">
            </div>
          </div>

          <h2 class="font-semibold text-nova-dark pt-4">Dirección de envío</h2>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label class="block text-sm mb-1">Departamento *</label>
              <select [(ngModel)]="form.department" name="department" required class="input">
                <option value="">Seleccionar...</option>
                @for (d of departments; track d) { <option [value]="d">{{ d }}</option> }
              </select>
            </div>
            <div>
              <label class="block text-sm mb-1">Ciudad / municipio *</label>
              <input [(ngModel)]="form.city" name="city" required autocomplete="address-level2" class="input">
            </div>
            <div class="md:col-span-2">
              <label class="block text-sm mb-1">Dirección *</label>
              <input [(ngModel)]="form.address" name="address" required autocomplete="street-address" placeholder="Calle, número, barrio, apto/casa" class="input">
            </div>
            <div class="md:col-span-2">
              <label class="block text-sm mb-1">Notas para la entrega</label>
              <textarea [(ngModel)]="form.notes" name="notes" rows="2" class="input"></textarea>
            </div>
          </div>
        </div>

        <div class="border border-nova-blush rounded-lg p-5 h-fit">
          <h2 class="font-semibold text-nova-dark mb-4">Tu pedido</h2>
          @for (item of cart.items(); track item.productId + item.size) {
            <div class="flex justify-between gap-2 text-sm text-nova-gray mb-2">
              <span class="truncate">{{ item.quantity }} × {{ item.name }} ({{ item.size }})</span>
              <span class="shrink-0">{{ item.price * item.quantity | currency:'COP':'$':'1.0-0' }}</span>
            </div>
          }
          <div class="flex justify-between text-sm text-nova-gray border-t border-nova-blush pt-3 mt-3 mb-2">
            <span>Envío</span>
            <span>{{ shipping() === 0 ? 'Gratis' : (shipping() | currency:'COP':'$':'1.0-0') }}</span>
          </div>
          <div class="flex justify-between font-semibold text-nova-dark mb-5">
            <span>Total</span><span>{{ cart.subtotal() + shipping() | currency:'COP':'$':'1.0-0' }} COP</span>
          </div>

          <label class="flex items-start gap-2 text-xs text-nova-gray mb-4">
            <input type="checkbox" [(ngModel)]="form.accept" name="accept" required class="mt-0.5">
            <span>Acepto la <a routerLink="/garantias-y-cambios" target="_blank" class="underline text-nova-dark">política de garantías y cambios</a> y el tratamiento de mis datos para gestionar el pedido.</span>
          </label>

          @if (error) {
            <div class="bg-red-50 text-red-600 p-3 rounded mb-4 text-sm">{{ error }}</div>
          }

          <button type="submit" [disabled]="f.invalid || loading || cart.items().length === 0"
                  class="w-full bg-nova-dark text-white py-3 rounded-lg font-medium text-sm uppercase tracking-wider hover:bg-nova-black transition disabled:opacity-50 disabled:cursor-not-allowed">
            {{ loading ? 'Procesando pago...' : 'Pagar con Wompi' }}
          </button>
          <p class="text-[11px] text-nova-gray text-center mt-2">Tarjeta, PSE, Nequi o Botón Bancolombia. Serás redirigida a Wompi para pagar de forma segura.</p>
        </div>
      </form>
    </div>
  `,
  styles: [`
    .input { @apply w-full border border-nova-blush rounded px-3 py-2 text-sm bg-white focus:outline-none focus:border-nova-rose; }
  `],
})
export class CheckoutComponent implements OnInit {
  departments = DEPARTMENTS;
  form = { name: '', email: '', phone: '', documentId: '', department: '', city: '', address: '', notes: '', accept: false };
  loading = false;
  error = '';

  private shippingCost = signal(0);
  private freeFrom = signal(0);
  shipping = computed(() =>
    this.freeFrom() > 0 && this.cart.subtotal() >= this.freeFrom() ? 0 : this.shippingCost()
  );

  constructor(public cart: CartService, private api: ApiService, private router: Router) {}

  ngOnInit() {
    if (this.cart.items().length === 0) {
      this.router.navigate(['/carrito']);
      return;
    }
    this.api.getSettings().subscribe(s => {
      this.shippingCost.set(parseInt(s['shippingCost'] || '0', 10) || 0);
      this.freeFrom.set(parseInt(s['freeShippingFrom'] || '0', 10) || 0);
    });
  }

  pay() {
    this.loading = true;
    this.error = '';
    const { accept, ...customer } = this.form;
    const items = this.cart.items().map(i => ({ productId: i.productId, size: i.size, quantity: i.quantity }));
    this.api.checkout({ items, customer }).subscribe({
      next: res => { window.location.href = res.checkoutUrl; },
      error: err => {
        this.error = err?.error?.message || 'No se pudo iniciar el pago. Intenta de nuevo.';
        this.loading = false;
      },
    });
  }
}
