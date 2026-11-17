import { Component, OnInit } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../../services/api.service';
import { DiscountCode } from '../../../models/types';

const emptyForm = () => ({
  code: '',
  percent: 20,
  firstPurchaseOnly: true,
  maxUses: null as number | null,
  expiresAt: '',
  description: '',
  isWelcome: false,
});

@Component({
  selector: 'app-admin-discounts',
  standalone: true,
  imports: [DatePipe, FormsModule],
  template: `
    <div class="w-full">
      <h1 class="font-display text-3xl font-bold text-nova-dark mb-6">Descuentos</h1>

      @if (message) { <div class="bg-green-50 text-green-700 p-3 rounded mb-4 text-sm">{{ message }}</div> }
      @if (error) { <div class="bg-red-50 text-red-600 p-3 rounded mb-4 text-sm">{{ error }}</div> }

      <!-- Cupón de bienvenida -->
      <section class="bg-white border border-nova-blush rounded-lg p-5 mb-6">
        <div class="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 class="font-semibold text-nova-dark">Cupón de bienvenida</h2>
            <p class="text-sm text-nova-gray mt-1 max-w-xl">
              Lo entrega el modal de suscripción de la página de inicio. Si lo desactivas, el modal y su texto dejan de mostrarse
              y el código deja de funcionar en el checkout.
            </p>
          </div>
          @if (welcome) {
            <label class="flex items-center gap-3 cursor-pointer select-none">
              <span class="text-sm font-medium" [class.text-green-700]="welcome.active" [class.text-nova-gray]="!welcome.active">
                {{ welcome.active ? 'Activo' : 'Desactivado' }}
              </span>
              <button type="button" role="switch" [attr.aria-checked]="welcome.active" (click)="toggleActive(welcome)" [disabled]="busy"
                      class="relative w-12 h-7 rounded-full transition" [class.bg-green-600]="welcome.active" [class.bg-gray-300]="!welcome.active">
                <span class="absolute top-1 left-1 w-5 h-5 rounded-full bg-white shadow transition-transform" [class.translate-x-5]="welcome.active"></span>
              </button>
            </label>
          }
        </div>

        @if (welcome) {
          <div class="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
            <span class="font-mono text-lg text-nova-dark">{{ welcome.code }}</span>
            <span class="text-nova-dark">{{ welcome.percent }}% · {{ welcome.firstPurchaseOnly ? 'solo primera compra' : 'para todos' }}</span>
            <span class="text-nova-gray">Usado {{ welcome.usedCount }}{{ welcome.maxUses ? ' de ' + welcome.maxUses : '' }} veces</span>
            @if (welcome.expiresAt) { <span class="text-nova-gray">Vence {{ welcome.expiresAt | date:'dd/MM/yyyy' }}</span> }
          </div>
        } @else {
          <p class="mt-4 text-sm text-nova-gray">No hay cupón de bienvenida: el modal no se muestra en la tienda.</p>
        }
        <button type="button" (click)="quickWelcome()" [disabled]="busy"
                class="mt-4 text-sm px-4 py-2 rounded border border-nova-dark text-nova-dark hover:bg-nova-dark hover:text-white transition disabled:opacity-40">
          {{ welcome ? 'Generar un cupón de bienvenida nuevo (20% primera compra)' : 'Crear cupón de bienvenida (20% primera compra)' }}
        </button>
      </section>

      <!-- Crear código -->
      <section class="bg-white border border-nova-blush rounded-lg p-5 mb-6">
        <h2 class="font-semibold text-nova-dark mb-4">Crear código</h2>
        <form (ngSubmit)="create()" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-sm">
          <label class="block">
            <span class="block text-nova-gray mb-1">Código</span>
            <input [(ngModel)]="form.code" name="code" placeholder="Vacío = se genera solo" class="input uppercase">
          </label>
          <label class="block">
            <span class="block text-nova-gray mb-1">Descuento (%)</span>
            <input [(ngModel)]="form.percent" name="percent" type="number" min="1" max="100" required class="input">
          </label>
          <label class="block">
            <span class="block text-nova-gray mb-1">Usos máximos</span>
            <input [(ngModel)]="form.maxUses" name="maxUses" type="number" min="1" placeholder="Ilimitado" class="input">
          </label>
          <label class="block">
            <span class="block text-nova-gray mb-1">Vence</span>
            <input [(ngModel)]="form.expiresAt" name="expiresAt" type="date" class="input">
          </label>
          <label class="block sm:col-span-2">
            <span class="block text-nova-gray mb-1">Nota interna (opcional)</span>
            <input [(ngModel)]="form.description" name="description" placeholder="Ej.: campaña Black Friday" class="input">
          </label>
          <div class="flex flex-col justify-end gap-2 sm:col-span-2 lg:col-span-1">
            <label class="flex items-center gap-2"><input type="checkbox" [(ngModel)]="form.firstPurchaseOnly" name="firstPurchaseOnly"> Solo primera compra</label>
            <label class="flex items-center gap-2"><input type="checkbox" [(ngModel)]="form.isWelcome" name="isWelcome"> Usar como cupón de bienvenida</label>
          </div>
          <div class="flex items-end">
            <button type="submit" [disabled]="busy || !(form.percent >= 1 && form.percent <= 100)"
                    class="w-full bg-nova-dark text-white px-4 py-2 rounded hover:bg-nova-black transition disabled:opacity-40">Crear código</button>
          </div>
        </form>
      </section>

      <!-- Lista -->
      <div class="bg-white border border-nova-blush rounded-lg overflow-x-auto">
        <table class="w-full text-sm">
          <thead class="bg-nova-pink text-nova-dark text-left">
            <tr>
              <th class="px-3 py-2.5 font-semibold">Código</th>
              <th class="px-3 py-2.5 font-semibold text-right">%</th>
              <th class="px-3 py-2.5 font-semibold">Para</th>
              <th class="px-3 py-2.5 font-semibold text-center">Usos</th>
              <th class="px-3 py-2.5 font-semibold">Vence</th>
              <th class="px-3 py-2.5 font-semibold">Estado</th>
              <th class="px-3 py-2.5 font-semibold text-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            @if (!loading && codes.length === 0) {
              <tr><td colspan="7" class="px-3 py-10 text-center text-nova-gray">Todavía no hay códigos.</td></tr>
            }
            @for (d of codes; track d.id) {
              <tr class="border-t border-nova-blush">
                <td class="px-3 py-2.5">
                  <span class="font-mono text-nova-dark">{{ d.code }}</span>
                  @if (d.isWelcome) { <span class="ml-2 px-2 py-0.5 rounded text-xs bg-nova-pink text-nova-dark">Bienvenida</span> }
                  @if (d.description) { <span class="block text-xs text-nova-gray">{{ d.description }}</span> }
                </td>
                <td class="px-3 py-2.5 text-right text-nova-dark">{{ d.percent }}%</td>
                <td class="px-3 py-2.5 text-nova-gray whitespace-nowrap">{{ d.firstPurchaseOnly ? 'Primera compra' : 'Todos' }}</td>
                <td class="px-3 py-2.5 text-center text-nova-gray">{{ d.usedCount }}{{ d.maxUses ? ' / ' + d.maxUses : '' }}</td>
                <td class="px-3 py-2.5 text-nova-gray whitespace-nowrap">{{ d.expiresAt ? (d.expiresAt | date:'dd/MM/yyyy') : '—' }}</td>
                <td class="px-3 py-2.5">
                  <span class="px-2 py-0.5 rounded text-xs whitespace-nowrap" [class]="statusClass(d)">{{ statusLabel(d) }}</span>
                </td>
                <td class="px-3 py-2.5 text-right whitespace-nowrap">
                  <button (click)="toggleActive(d)" [disabled]="busy" class="text-xs underline text-nova-dark mr-3">{{ d.active ? 'Desactivar' : 'Activar' }}</button>
                  @if (!d.isWelcome) {
                    <button (click)="makeWelcome(d)" [disabled]="busy" class="text-xs underline text-nova-dark mr-3">Usar en bienvenida</button>
                  }
                  <button (click)="copy(d.code)" class="text-xs underline text-nova-gray mr-3">{{ copied === d.code ? 'Copiado' : 'Copiar' }}</button>
                  <button (click)="remove(d)" [disabled]="busy" class="text-xs underline text-red-600">Eliminar</button>
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    </div>
  `,
  styles: [`
    .input { @apply w-full border border-nova-blush rounded px-3 py-2 bg-white focus:outline-none focus:border-nova-rose; }
  `],
})
export class AdminDiscountsComponent implements OnInit {
  codes: DiscountCode[] = [];
  form = emptyForm();
  loading = false;
  busy = false;
  message = '';
  error = '';
  copied = '';

  constructor(private api: ApiService) {}

  ngOnInit() { this.load(); }

  get welcome(): DiscountCode | undefined { return this.codes.find(d => d.isWelcome); }

  load() {
    this.loading = true;
    this.api.getDiscounts().subscribe({
      next: codes => { this.codes = codes; this.loading = false; },
      error: () => { this.error = 'No se pudieron cargar los códigos'; this.loading = false; },
    });
  }

  private run<T>(request: ReturnType<ApiService['getDiscounts']> | any, ok: string, after?: (r: T) => void) {
    this.busy = true;
    this.message = '';
    this.error = '';
    request.subscribe({
      next: (r: T) => { this.busy = false; this.message = ok; after?.(r); this.load(); },
      error: (err: any) => { this.busy = false; this.error = err?.error?.message || 'No se pudo guardar'; },
    });
  }

  create() {
    const f = this.form;
    this.run<DiscountCode>(
      this.api.createDiscount({
        code: f.code.trim(),
        percent: Number(f.percent),
        firstPurchaseOnly: f.firstPurchaseOnly,
        maxUses: f.maxUses ? Number(f.maxUses) : null,
        expiresAt: f.expiresAt ? `${f.expiresAt}T23:59:59-05:00` : null,
        description: f.description.trim() || undefined,
        isWelcome: f.isWelcome,
        prefix: f.isWelcome ? 'BIENVENIDA' : 'NOVA',
      }),
      'Código creado',
      (d) => { this.message = `Código ${d.code} creado`; this.form = emptyForm(); },
    );
  }

  /** Genera al instante un cupón nuevo de 20% para la primera compra y lo pone en el modal */
  quickWelcome() {
    this.run<DiscountCode>(
      this.api.createDiscount({ percent: 20, firstPurchaseOnly: true, isWelcome: true, prefix: 'BIENVENIDA' }),
      'Cupón de bienvenida creado',
      (d) => { this.message = `Nuevo cupón de bienvenida: ${d.code} (20% primera compra). El modal ya lo entrega.`; },
    );
  }

  toggleActive(d: DiscountCode) {
    const active = !d.active;
    this.run(this.api.updateDiscount(d.id, { active }),
      d.isWelcome
        ? (active ? 'Cupón de bienvenida activado: el modal vuelve a mostrarse' : 'Cupón de bienvenida desactivado: el modal ya no se muestra')
        : (active ? `Código ${d.code} activado` : `Código ${d.code} desactivado`));
  }

  makeWelcome(d: DiscountCode) {
    this.run(this.api.updateDiscount(d.id, { isWelcome: true, active: true }), `${d.code} es ahora el cupón de bienvenida`);
  }

  remove(d: DiscountCode) {
    if (!confirm(`¿Eliminar el código ${d.code}?`)) return;
    this.run<{ message: string }>(this.api.deleteDiscount(d.id), 'Código eliminado', (r) => { this.message = r.message; });
  }

  copy(code: string) {
    navigator.clipboard?.writeText(code).then(() => (this.copied = code)).catch(() => {});
  }

  private expired(d: DiscountCode) { return !!d.expiresAt && new Date(d.expiresAt).getTime() < Date.now(); }
  private exhausted(d: DiscountCode) { return d.maxUses !== null && d.usedCount >= d.maxUses; }

  statusLabel(d: DiscountCode) {
    if (!d.active) return 'Desactivado';
    if (this.expired(d)) return 'Vencido';
    if (this.exhausted(d)) return 'Agotado';
    return 'Activo';
  }

  statusClass(d: DiscountCode) {
    return this.statusLabel(d) === 'Activo' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-nova-gray';
  }
}
