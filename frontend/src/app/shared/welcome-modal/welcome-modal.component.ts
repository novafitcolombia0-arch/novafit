import { Component, HostListener, OnDestroy, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ApiService } from '../../services/api.service';

// Claves en el navegador: el modal sale una sola vez y el código se rellena solo en el checkout
export const WELCOME_SEEN_KEY = 'nova_welcome_seen';
export const WELCOME_CODE_KEY = 'nova_welcome_code';

const store = {
  get: (k: string) => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k: string, v: string) => { try { localStorage.setItem(k, v); } catch {} },
};

@Component({
    selector: 'app-welcome-modal',
    imports: [FormsModule, RouterLink],
    template: `
    @if (open) {
      <div class="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50" (click)="close()">
        <div role="dialog" aria-modal="true" aria-labelledby="welcome-title"
             class="relative w-full max-w-md bg-white rounded-lg shadow-xl p-8 text-center" (click)="$event.stopPropagation()">
          <button (click)="close()" aria-label="Cerrar"
                  class="absolute top-3 right-3 w-8 h-8 rounded-full text-nova-gray hover:bg-nova-pink hover:text-nova-dark">✕</button>
          <img src="assets/monogram-black.png" alt="" class="h-14 w-auto mx-auto mb-5">

          @if (!code) {
            <p class="text-xs uppercase tracking-widest text-nova-rose mb-2">Bienvenida a Nova FIT</p>
            <h2 id="welcome-title" class="text-3xl font-bold text-nova-dark mb-2">{{ percent }}% de descuento</h2>
            <p class="text-sm text-nova-gray mb-6">
              {{ firstPurchaseOnly ? 'en tu primera compra' : 'en tu compra' }} al suscribirte. Recibe también nuestros lanzamientos y promociones.
            </p>
            <form (ngSubmit)="submit()" #f="ngForm" class="space-y-3 text-left">
              <input [(ngModel)]="name" name="name" autocomplete="given-name" placeholder="Tu nombre (opcional)"
                     class="w-full border border-nova-blush rounded px-3 py-2.5 text-sm focus:outline-none focus:border-nova-rose">
              <input [(ngModel)]="email" name="email" type="email" required email autocomplete="email" placeholder="Tu correo electrónico"
                     class="w-full border border-nova-blush rounded px-3 py-2.5 text-sm focus:outline-none focus:border-nova-rose">
              @if (error) { <p class="text-sm text-red-600">{{ error }}</p> }
              <button type="submit" [disabled]="f.invalid || loading"
                      class="w-full bg-nova-dark text-white py-3 rounded text-sm uppercase tracking-widest hover:bg-nova-black transition disabled:opacity-50">
                {{ loading ? 'Enviando…' : 'Quiero mi ' + percent + '%' }}
              </button>
            </form>
            <button (click)="close()" class="mt-4 text-xs text-nova-gray underline">No, gracias</button>
          } @else {
            <p class="text-xs uppercase tracking-widest text-nova-rose mb-2">¡Gracias por suscribirte!</p>
            <h2 id="welcome-title" class="text-2xl font-bold text-nova-dark mb-4">Tu código de {{ percent }}%</h2>
            <div class="flex items-center justify-center gap-2 mb-3">
              <span class="font-mono text-xl tracking-wider border-2 border-dashed border-nova-rose rounded px-4 py-2 text-nova-dark">{{ code }}</span>
              <button (click)="copy()" class="text-sm px-3 py-2 rounded border border-nova-blush hover:bg-nova-pink">{{ copied ? 'Copiado' : 'Copiar' }}</button>
            </div>
            <p class="text-sm text-nova-gray mb-6">
              {{ firstPurchaseOnly ? 'Válido en tu primera compra.' : '' }} Ya quedó guardado: se aplicará al finalizar tu compra.
            </p>
            <a routerLink="/catalogo" (click)="close()"
               class="inline-block bg-nova-dark text-white px-8 py-3 rounded text-sm uppercase tracking-widest hover:bg-nova-black transition">Shop Now</a>
          }
        </div>
      </div>
    }
  `
})
export class WelcomeModalComponent implements OnInit, OnDestroy {
  open = false;
  percent = 0;
  firstPurchaseOnly = false;
  name = '';
  email = '';
  code = '';
  error = '';
  loading = false;
  copied = false;
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor(private api: ApiService) {}

  ngOnInit() {
    if (store.get(WELCOME_SEEN_KEY)) return;
    // Solo aparece si hay un cupón de bienvenida activo; si se desactiva en el panel, no se muestra nada
    this.api.getWelcomeOffer().subscribe({
      next: offer => {
        if (!offer.enabled || !offer.percent) return;
        this.percent = offer.percent;
        this.firstPurchaseOnly = !!offer.firstPurchaseOnly;
        this.timer = setTimeout(() => (this.open = true), 3000);
      },
      error: () => {},
    });
  }

  ngOnDestroy() { if (this.timer) clearTimeout(this.timer); }

  @HostListener('document:keydown.escape')
  onEscape() { if (this.open) this.close(); }

  submit() {
    this.loading = true;
    this.error = '';
    this.api.subscribe(this.email.trim(), this.name.trim() || undefined).subscribe({
      next: res => {
        this.loading = false;
        store.set(WELCOME_SEEN_KEY, '1');
        if (res.code) {
          this.code = res.code;
          this.percent = res.percent ?? this.percent;
          store.set(WELCOME_CODE_KEY, res.code);
        } else {
          this.close(); // el cupón se desactivó justo ahora: solo queda suscrita
        }
      },
      error: err => { this.loading = false; this.error = err?.error?.message || 'No se pudo completar la suscripción'; },
    });
  }

  copy() {
    navigator.clipboard?.writeText(this.code).then(() => (this.copied = true)).catch(() => {});
  }

  close() {
    this.open = false;
    store.set(WELCOME_SEEN_KEY, '1');
  }
}
