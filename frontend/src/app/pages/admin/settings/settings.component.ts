import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../../services/api.service';
import { AuthService } from '../../../services/auth.service';
import { compressImage } from '../../../services/image-compress';

@Component({
    selector: 'app-admin-settings',
    imports: [FormsModule],
    template: `
    <div class="max-w-4xl">
      <h1 class="font-display text-3xl font-bold mb-8 text-nova-dark">Configuración del Sitio</h1>

      @if (saved) {
        <div class="bg-green-50 text-green-700 p-3 rounded mb-4 text-sm">Guardado correctamente</div>
      }
      @if (error) {
        <div class="bg-red-50 text-red-600 p-3 rounded mb-4 text-sm">{{ error }}</div>
      }

      <div class="bg-white border border-nova-blush rounded-lg p-6 mb-6">
        <h2 class="font-semibold text-lg mb-4 text-nova-dark">Carrusel Hero (Página Principal)</h2>
        <p class="text-sm text-nova-gray mb-4">Sube varias imágenes que se mostrarán en el carrusel automático del homepage.</p>

        <input type="file" accept="image/*" multiple (change)="onImagesSelected($event)"
               class="block w-full text-sm text-nova-gray file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-nova-pink file:text-nova-dark hover:file:bg-nova-blush">

        @if (heroImages.length > 0) {
          <button (click)="optimizeExisting()" [disabled]="optimizing"
                  class="mt-3 text-sm text-nova-dark underline hover:text-nova-rose disabled:opacity-50">
            {{ optimizing ? 'Optimizando...' : 'Optimizar imágenes actuales (más rápidas de cargar)' }}
          </button>
          <p class="text-xs text-nova-gray mt-1">Después de optimizar, pulsa "Guardar Configuración".</p>
        }

        @if (heroImages.length > 0) {
          <div class="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3">
            @for (img of heroImages; track $index) {
              <div class="relative group">
                <img [src]="img" class="w-full h-32 object-cover rounded-lg border">
                <button (click)="removeImage($index)"
                        class="absolute top-1 right-1 bg-red-500 text-white rounded-full w-6 h-6 text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition">
                  x
                </button>
                <span class="absolute bottom-1 left-1 bg-nova-dark bg-opacity-80 text-white text-[10px] px-1 rounded">
                  #{{ $index + 1 }}
                </span>
              </div>
            }
          </div>
        } @else {
          <div class="mt-4 bg-nova-pink rounded-lg h-32 flex items-center justify-center text-nova-gray text-sm">
            No hay imágenes. Se muestra fondo negro por defecto.
          </div>
        }
      </div>

      <div class="bg-white border border-nova-blush rounded-lg p-6 mb-6">
        <h2 class="font-semibold text-lg mb-4 text-nova-dark">Envíos</h2>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label class="block text-sm font-medium mb-1">Costo de envío (COP)</label>
            <input type="number" min="0" [(ngModel)]="shippingCost" name="shippingCost"
                   class="w-full border border-nova-blush rounded px-3 py-2 focus:outline-none focus:border-nova-rose">
            <p class="text-xs text-nova-gray mt-1">Se suma al total en el pago. 0 = envío gratis.</p>
          </div>
          <div>
            <label class="block text-sm font-medium mb-1">Envío gratis desde (COP)</label>
            <input type="number" min="0" [(ngModel)]="freeShippingFrom" name="freeShippingFrom"
                   class="w-full border border-nova-blush rounded px-3 py-2 focus:outline-none focus:border-nova-rose">
            <p class="text-xs text-nova-gray mt-1">Compras desde este valor no pagan envío. 0 = desactivado.</p>
          </div>
        </div>
      </div>

      <button (click)="save()" [disabled]="saving"
              class="bg-nova-dark text-white px-6 py-2 text-sm rounded hover:bg-opacity-90 transition disabled:opacity-50">
        {{ saving ? 'Guardando...' : 'Guardar Configuración' }}
      </button>

      <!-- Seguridad -->
      <div class="bg-white border border-nova-blush rounded-lg p-6 mt-10">
        <h2 class="font-semibold text-lg mb-1 text-nova-dark">Cambiar contraseña</h2>
        <p class="text-sm text-nova-gray mb-4">Mínimo 12 caracteres. Al cambiarla se cierran las sesiones abiertas en otros dispositivos.</p>
        @if (pwMessage) { <div class="bg-green-50 text-green-700 p-3 rounded mb-4 text-sm">{{ pwMessage }}</div> }
        @if (pwError) { <div class="bg-red-50 text-red-600 p-3 rounded mb-4 text-sm">{{ pwError }}</div> }
        <form (ngSubmit)="changePassword()" class="grid grid-cols-1 md:grid-cols-3 gap-4">
          <label class="block">
            <span class="block text-sm font-medium mb-1">Contraseña actual</span>
            <input type="password" [(ngModel)]="pw.current" name="currentPassword" autocomplete="current-password" required
                   class="w-full border border-nova-blush rounded px-3 py-2 focus:outline-none focus:border-nova-rose">
          </label>
          <label class="block">
            <span class="block text-sm font-medium mb-1">Nueva contraseña</span>
            <input type="password" [(ngModel)]="pw.next" name="newPassword" autocomplete="new-password" required minlength="12"
                   class="w-full border border-nova-blush rounded px-3 py-2 focus:outline-none focus:border-nova-rose">
          </label>
          <label class="block">
            <span class="block text-sm font-medium mb-1">Repetir nueva contraseña</span>
            <input type="password" [(ngModel)]="pw.confirm" name="confirmPassword" autocomplete="new-password" required
                   class="w-full border border-nova-blush rounded px-3 py-2 focus:outline-none focus:border-nova-rose">
          </label>
          <div class="md:col-span-3">
            <button type="submit" [disabled]="changingPw || !pw.current || pw.next.length < 12 || pw.next !== pw.confirm"
                    class="bg-nova-dark text-white px-6 py-2 text-sm rounded hover:bg-opacity-90 transition disabled:opacity-50">
              {{ changingPw ? 'Guardando…' : 'Cambiar contraseña' }}
            </button>
            @if (pw.confirm && pw.next !== pw.confirm) { <span class="text-xs text-red-600 ml-3">Las contraseñas no coinciden</span> }
          </div>
        </form>
      </div>
    </div>
  `
})
export class AdminSettingsComponent implements OnInit {
  heroImages: string[] = [];
  shippingCost = 0;
  freeShippingFrom = 0;
  saving = false;
  optimizing = false;
  saved = false;
  error = '';

  pw = { current: '', next: '', confirm: '' };
  changingPw = false;
  pwMessage = '';
  pwError = '';

  constructor(private api: ApiService, private auth: AuthService) {}

  changePassword() {
    this.changingPw = true;
    this.pwMessage = '';
    this.pwError = '';
    this.api.changePassword(this.pw.current, this.pw.next).subscribe({
      next: res => {
        this.auth.setToken(res.token); // esta sesión sigue abierta con el token nuevo
        this.pw = { current: '', next: '', confirm: '' };
        this.pwMessage = res.message;
        this.changingPw = false;
      },
      error: err => {
        this.pwError = err?.error?.message || 'No se pudo cambiar la contraseña';
        this.changingPw = false;
      },
    });
  }

  ngOnInit() {
    this.api.getAdminSettings().subscribe(settings => {
      this.shippingCost = parseInt(settings['shippingCost'] || '0', 10) || 0;
      this.freeShippingFrom = parseInt(settings['freeShippingFrom'] || '0', 10) || 0;
      if (settings['heroImages']) {
        try { this.heroImages = JSON.parse(settings['heroImages']); } catch { this.heroImages = []; }
      }
    });
  }

  async onImagesSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (!input.files) return;
    const images = await Promise.all(Array.from(input.files).map(file => compressImage(file, 1920)));
    this.heroImages.push(...images);
    input.value = '';
  }

  async optimizeExisting() {
    this.optimizing = true;
    this.saved = false;
    this.error = '';
    try {
      this.heroImages = await Promise.all(this.heroImages.map(img => compressImage(img, 1920)));
    } catch {
      this.error = 'No se pudieron optimizar las imágenes';
    }
    this.optimizing = false;
  }

  removeImage(index: number) {
    this.heroImages.splice(index, 1);
  }

  save() {
    this.saving = true;
    this.saved = false;
    this.error = '';
    this.api.updateSettings({
      heroImages: JSON.stringify(this.heroImages),
      shippingCost: String(Math.max(0, Math.round(Number(this.shippingCost) || 0))),
      freeShippingFrom: String(Math.max(0, Math.round(Number(this.freeShippingFrom) || 0))),
    }).subscribe({
      next: () => { this.saved = true; this.saving = false; },
      error: () => { this.error = 'Error al guardar'; this.saving = false; },
    });
  }
}
