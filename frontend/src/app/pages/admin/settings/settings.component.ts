import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../../services/api.service';

@Component({
  selector: 'app-admin-settings',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="max-w-4xl mx-auto px-4 py-8">
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

      <button (click)="save()" [disabled]="saving"
              class="bg-nova-dark text-white px-6 py-2 text-sm rounded hover:bg-opacity-90 transition disabled:opacity-50">
        {{ saving ? 'Guardando...' : 'Guardar Configuración' }}
      </button>
    </div>
  `,
})
export class AdminSettingsComponent implements OnInit {
  heroImages: string[] = [];
  saving = false;
  saved = false;
  error = '';

  constructor(private api: ApiService) {}

  ngOnInit() {
    this.api.getSettings().subscribe(settings => {
      if (settings['heroImages']) {
        try { this.heroImages = JSON.parse(settings['heroImages']); } catch { this.heroImages = []; }
      }
    });
  }

  onImagesSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (!input.files) return;
    Array.from(input.files).forEach(file => {
      const reader = new FileReader();
      reader.onload = () => {
        this.heroImages.push(reader.result as string);
      };
      reader.readAsDataURL(file);
    });
  }

  removeImage(index: number) {
    this.heroImages.splice(index, 1);
  }

  save() {
    this.saving = true;
    this.saved = false;
    this.error = '';
    this.api.updateSettings({ heroImages: JSON.stringify(this.heroImages) }).subscribe({
      next: () => { this.saved = true; this.saving = false; },
      error: () => { this.error = 'Error al guardar'; this.saving = false; },
    });
  }
}
