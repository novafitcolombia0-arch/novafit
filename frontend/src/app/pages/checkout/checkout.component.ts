import { Component, OnInit, computed, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { CurrencyPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CartService } from '../../services/cart.service';
import { ApiService } from '../../services/api.service';
import { WELCOME_CODE_KEY } from '../../shared/welcome-modal/welcome-modal.component';

const DEPARTMENTS = [
  'Amazonas', 'Antioquia', 'Arauca', 'Atlántico', 'Bogotá D.C.', 'Bolívar', 'Boyacá', 'Caldas',
  'Caquetá', 'Casanare', 'Cauca', 'Cesar', 'Chocó', 'Córdoba', 'Cundinamarca', 'Guainía',
  'Guaviare', 'Huila', 'La Guajira', 'Magdalena', 'Meta', 'Nariño', 'Norte de Santander',
  'Putumayo', 'Quindío', 'Risaralda', 'San Andrés y Providencia', 'Santander', 'Sucre',
  'Tolima', 'Valle del Cauca', 'Vaupés', 'Vichada',
];

@Component({
    selector: 'app-checkout',
    imports: [RouterLink, CurrencyPipe, FormsModule],
    template: `
    <div class="max-w-5xl mx-auto px-4 py-8">
      <h1 class="font-display text-3xl font-bold mb-8 text-nova-dark">Finalizar compra</h1>

      <form (ngSubmit)="pay()" #f="ngForm" class="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div class="lg:col-span-2 space-y-4">
          <p class="text-xs text-nova-gray">Todos los campos con <span class="text-red-600">*</span> son obligatorios.</p>
          <h2 class="font-semibold text-nova-dark">Datos de contacto</h2>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div class="md:col-span-2">
              <label class="block text-sm mb-1">Nombre completo <span class="req">*</span></label>
              <input [(ngModel)]="form.name" name="name" #name="ngModel" required minlength="3" autocomplete="name" class="input">
              @if (name.invalid && name.touched) { <p class="err">Escribe tu nombre completo</p> }
            </div>
            <div>
              <label class="block text-sm mb-1">Correo electrónico <span class="req">*</span></label>
              <input [(ngModel)]="form.email" name="email" #email="ngModel" type="email" required pattern="[^@ ]+@[^@ ]+[.][^@ ]+" autocomplete="email" class="input">
              @if (email.invalid && email.touched) { <p class="err">Escribe un correo válido</p> }
            </div>
            <div>
              <label class="block text-sm mb-1">Celular <span class="req">*</span></label>
              <input [(ngModel)]="form.phone" name="phone" #phone="ngModel" type="tel" inputmode="numeric" required pattern="3[0-9]{9}" maxlength="10" autocomplete="tel" placeholder="3001234567" class="input">
              @if (phone.invalid && phone.touched) { <p class="err">10 dígitos, empezando por 3</p> }
            </div>
            <div>
              <label class="block text-sm mb-1">Cédula <span class="req">*</span></label>
              <input [(ngModel)]="form.documentId" name="documentId" #doc="ngModel" inputmode="numeric" required pattern="[0-9]{5,12}" maxlength="12" class="input">
              @if (doc.invalid && doc.touched) { <p class="err">Solo números, sin puntos</p> }
            </div>
          </div>

          <h2 class="font-semibold text-nova-dark pt-4">Dirección de envío</h2>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label class="block text-sm mb-1">Departamento <span class="req">*</span></label>
              <select [(ngModel)]="form.department" name="department" required class="input">
                <option value="">Seleccionar...</option>
                @for (d of departments; track d) { <option [value]="d">{{ d }}</option> }
              </select>
            </div>
            <div>
              <label class="block text-sm mb-1">Ciudad / municipio <span class="req">*</span></label>
              <input [(ngModel)]="form.city" name="city" required minlength="2" autocomplete="address-level2" class="input">
            </div>
            <div class="md:col-span-2">
              <label class="block text-sm mb-1">Dirección <span class="req">*</span></label>
              <input [(ngModel)]="form.address" name="address" required minlength="5" autocomplete="street-address" placeholder="Calle, número, barrio, apto/casa" class="input">
            </div>
            <div class="md:col-span-2">
              <label class="block text-sm mb-1">Notas para la entrega <span class="text-nova-gray">(opcional)</span></label>
              <textarea [(ngModel)]="form.notes" name="notes" rows="2" class="input"></textarea>
            </div>
          </div>
        </div>

        <div class="border border-nova-blush rounded-lg p-5 h-fit">
          <h2 class="font-semibold text-nova-dark mb-4">Tu pedido</h2>
          @for (item of cart.items(); track item.productId + '|' + (item.color || '') + '|' + item.size) {
            <div class="flex justify-between gap-2 text-sm text-nova-gray mb-2">
              <span class="truncate">{{ item.quantity }} × {{ item.name }} ({{ variant(item) }})</span>
              <span class="shrink-0">{{ item.price * item.quantity | currency:'COP':'$':'1.0-0' }}</span>
            </div>
          }
          <!-- Código de descuento -->
          <div class="border-t border-nova-blush pt-3 mt-3 mb-3">
            @if (applied()) {
              <div class="flex items-center justify-between gap-2 text-sm bg-nova-pink rounded px-3 py-2">
                <span class="text-nova-dark">Código <strong class="font-mono">{{ applied()!.code }}</strong> · {{ applied()!.percent }}%</span>
                <button type="button" (click)="removeDiscount()" class="text-xs text-nova-gray underline">Quitar</button>
              </div>
            } @else {
              <div class="flex gap-2">
                <input [(ngModel)]="discountInput" name="discountCode" placeholder="Código de descuento" autocomplete="off"
                       (keydown.enter)="$event.preventDefault(); applyDiscount()" class="input uppercase">
                <button type="button" (click)="applyDiscount()" [disabled]="!discountInput.trim() || discountLoading"
                        class="shrink-0 px-4 rounded border border-nova-dark text-nova-dark text-sm hover:bg-nova-dark hover:text-white transition disabled:opacity-40">
                  {{ discountLoading ? '…' : 'Aplicar' }}
                </button>
              </div>
            }
            @if (discountError) { <p class="text-xs text-red-600 mt-1">{{ discountError }}</p> }
          </div>
          <div class="flex justify-between text-sm text-nova-gray mb-1">
            <span>Subtotal</span><span>{{ cart.subtotal() | currency:'COP':'$':'1.0-0' }}</span>
          </div>
          @if (discount() > 0) {
            <div class="flex justify-between text-sm text-green-700 mb-1">
              <span>Descuento ({{ applied()!.percent }}%)</span><span>−{{ discount() | currency:'COP':'$':'1.0-0' }}</span>
            </div>
          }
          <div class="flex justify-between text-sm text-nova-gray mb-2">
            <span>Envío</span>
            <span>{{ shipping() === 0 ? 'Gratis' : (shipping() | currency:'COP':'$':'1.0-0') }}</span>
          </div>
          <div class="flex justify-between font-semibold text-nova-dark mb-5 border-t border-nova-blush pt-2">
            <span>Total</span><span>{{ total() | currency:'COP':'$':'1.0-0' }} COP</span>
          </div>

          <label class="flex items-start gap-2 text-xs text-nova-gray mb-4">
            <input type="checkbox" [(ngModel)]="form.accept" name="accept" required class="mt-0.5">
            <span><span class="req">*</span> Acepto la <a routerLink="/garantias-y-cambios" target="_blank" class="underline text-nova-dark">política de garantías y cambios</a> y el tratamiento de mis datos para gestionar el pedido.</span>
          </label>

          @if (error) {
            <div class="bg-red-50 text-red-600 p-3 rounded mb-4 text-sm">{{ error }}</div>
          }
          @if (f.invalid) {
            <p class="text-xs text-nova-gray text-center mb-2">Completa todos los datos obligatorios (*) para poder pagar.</p>
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
    .input.ng-invalid.ng-touched { @apply border-red-400; }
    .req { @apply text-red-600; }
    .err { @apply text-xs text-red-600 mt-1; }
  `]
})
export class CheckoutComponent implements OnInit {
  departments = DEPARTMENTS;
  form = { name: '', email: '', phone: '', documentId: '', department: '', city: '', address: '', notes: '', accept: false };
  loading = false;
  error = '';

  private shippingCost = signal(0);
  private freeFrom = signal(0);

  discountInput = '';
  discountError = '';
  discountLoading = false;
  applied = signal<{ code: string; percent: number } | null>(null);
  // Mismo cálculo que el backend (que es quien decide el valor final)
  discount = computed(() => {
    const a = this.applied();
    return a ? Math.round((this.cart.subtotal() * a.percent) / 100) : 0;
  });
  shipping = computed(() => {
    const productsAfterDiscount = this.cart.subtotal() - this.discount();
    return this.freeFrom() > 0 && productsAfterDiscount >= this.freeFrom() ? 0 : this.shippingCost();
  });
  total = computed(() => this.cart.subtotal() - this.discount() + this.shipping());

  variant = CartService.variantLabel;

  constructor(public cart: CartService, private api: ApiService, private router: Router) {}

  ngOnInit() {
    if (this.cart.items().length === 0) {
      this.router.navigate(['/carrito']);
      return;
    }
    // Código guardado por el modal de bienvenida
    try { this.discountInput = localStorage.getItem(WELCOME_CODE_KEY) || ''; } catch {}
    this.api.getSettings().subscribe(s => {
      this.shippingCost.set(parseInt(s['shippingCost'] || '0', 10) || 0);
      this.freeFrom.set(parseInt(s['freeShippingFrom'] || '0', 10) || 0);
    });
  }

  applyDiscount() {
    const code = this.discountInput.trim().toUpperCase();
    if (!code) return;
    this.discountLoading = true;
    this.discountError = '';
    this.api.validateDiscount(code, this.form.email.trim(), this.cart.subtotal()).subscribe({
      next: res => { this.applied.set({ code: res.code, percent: res.percent }); this.discountLoading = false; },
      error: err => {
        this.discountError = err?.error?.message || 'No se pudo validar el código';
        this.discountLoading = false;
      },
    });
  }

  removeDiscount() {
    this.discountInput = this.applied()?.code || '';
    this.applied.set(null);
    this.discountError = '';
  }

  pay() {
    if (this.loading) return;
    this.loading = true;
    this.error = '';
    const { accept, ...customer } = this.form;
    const items = this.cart.items().map(i => ({ productId: i.productId, color: i.color || '', size: i.size, quantity: i.quantity }));
    this.api.checkout({ items, customer, discountCode: this.applied()?.code }).subscribe({
      next: res => { window.location.href = res.checkoutUrl; },
      error: err => {
        this.error = err?.error?.message || 'No se pudo iniciar el pago. Intenta de nuevo.';
        this.loading = false;
      },
    });
  }
}
