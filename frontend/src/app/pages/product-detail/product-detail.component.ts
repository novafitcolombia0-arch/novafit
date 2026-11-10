import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ApiService } from '../../services/api.service';
import { Product } from '../../models/types';
import { CurrencyPipe } from '@angular/common';

@Component({
  selector: 'app-product-detail',
  standalone: true,
  imports: [RouterLink, CurrencyPipe],
  template: `
    @if (product) {
      <div class="max-w-6xl mx-auto px-4 py-6">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <div class="bg-nova-pink rounded-lg overflow-hidden aspect-[3/4] mb-3 cursor-zoom-in">
              @if (mainImage) {
                <img [src]="mainImage" [alt]="product.name" class="w-full h-full object-cover transition-transform duration-500 ease-out hover:scale-110">
              } @else {
                <div class="flex items-center justify-center h-full text-nova-gray">Sin imagen</div>
              }
            </div>
            @if (product.images && product.images.length > 1) {
              <div class="flex gap-1.5">
                @for (img of product.images; track img.id) {
                  <button (click)="mainImage = img.imageData"
                          [class.border-2]="mainImage === img.imageData"
                          [class.border-nova-rose]="mainImage === img.imageData"
                          class="w-16 h-16 rounded overflow-hidden border border-nova-blush">
                    <img [src]="img.imageData" class="w-full h-full object-cover">
                  </button>
                }
              </div>
            }
          </div>

          <div class="pt-1">
            <p class="text-nova-gray text-xs uppercase tracking-wider mb-1">{{ product.category.name }}</p>
            <h1 class="font-display text-2xl font-bold mb-2 text-nova-dark">{{ product.name }}</h1>
            <p class="text-xl text-nova-gray mb-4">{{ product.price | currency:'COP':'$':'1.0-0' }} COP</p>

            <div class="mb-4">
              <p class="text-sm font-medium mb-2 text-nova-dark">Talla:</p>
              <div class="flex gap-2">
                @for (s of product.sizes; track s.id) {
                  <button (click)="selectSize(s.size)" [disabled]="s.stock <= 0"
                          [class.bg-nova-dark]="selectedSize === s.size"
                          [class.text-white]="selectedSize === s.size"
                          [class.border-nova-dark]="selectedSize !== s.size"
                          [class.opacity-40]="s.stock <= 0"
                          class="border border-nova-blush px-3 py-1.5 text-sm rounded transition">{{ s.size }}</button>
                }
              </div>
            </div>

            <button (click)="buyOnWhatsApp()" [disabled]="!selectedSize"
                    class="w-full bg-green-600 text-white py-3 rounded-lg font-medium text-sm uppercase tracking-wider hover:bg-green-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2">
              <svg class="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
              </svg>
              Comprar por WhatsApp
            </button>

            @if (!selectedSize) {
              <p class="text-center text-nova-gray text-xs mt-1">Selecciona una talla</p>
            }

            <div class="mt-6">
              <!-- Descripción -->
              <div class="border border-nova-blush rounded-lg mb-2">
                <button (click)="toggle('desc')"
                        class="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-nova-pink transition">
                  <span class="font-medium text-sm text-nova-dark">Descripción</span>
                  <svg [class.rotate-180]="openSection === 'desc'" class="w-5 h-5 text-nova-gray transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/>
                  </svg>
                </button>
                @if (openSection === 'desc') {
                  <div class="px-4 pb-3 text-nova-gray text-sm leading-relaxed border-t border-nova-blush">
                    @if (product.description) {
                      <p class="mt-3">{{ product.description }}</p>
                    } @else {
                      <p class="mt-3">Descripción no disponible.</p>
                    }
                  </div>
                }
              </div>

              <!-- Guía de Tallas -->
              <div class="border border-nova-blush rounded-lg mb-2">
                <button (click)="toggle('sizes')"
                        class="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-nova-pink transition">
                  <span class="font-medium text-sm text-nova-dark">Guía de Tallas</span>
                  <svg [class.rotate-180]="openSection === 'sizes'" class="w-5 h-5 text-nova-gray transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/>
                  </svg>
                </button>
                @if (openSection === 'sizes') {
                  <div class="px-4 pb-3 border-t border-nova-blush">
                    <div class="mt-3 overflow-x-auto">
                      <table class="w-full text-sm">
                        <thead>
                          <tr class="text-nova-gray">
                            <th class="text-left py-2 pr-4">Talla</th>
                            <th class="text-left py-2 pr-4">Busto (cm)</th>
                            <th class="text-left py-2 pr-4">Cintura (cm)</th>
                            <th class="text-left py-2">Cadera (cm)</th>
                          </tr>
                        </thead>
                        <tbody class="text-nova-dark">
                          <tr class="border-t border-nova-pink"><td class="py-2 pr-4 font-medium">XS</td><td class="py-2 pr-4">80-84</td><td class="py-2 pr-4">60-64</td><td class="py-2">86-90</td></tr>
                          <tr class="border-t border-nova-pink"><td class="py-2 pr-4 font-medium">S</td><td class="py-2 pr-4">84-88</td><td class="py-2 pr-4">64-68</td><td class="py-2">90-94</td></tr>
                          <tr class="border-t border-nova-pink"><td class="py-2 pr-4 font-medium">M</td><td class="py-2 pr-4">88-92</td><td class="py-2 pr-4">68-72</td><td class="py-2">94-98</td></tr>
                          <tr class="border-t border-nova-pink"><td class="py-2 pr-4 font-medium">L</td><td class="py-2 pr-4">92-96</td><td class="py-2 pr-4">72-76</td><td class="py-2">98-102</td></tr>
                          <tr class="border-t border-nova-pink"><td class="py-2 pr-4 font-medium">XL</td><td class="py-2 pr-4">96-100</td><td class="py-2 pr-4">76-80</td><td class="py-2">102-106</td></tr>
                          <tr class="border-t border-nova-pink"><td class="py-2 pr-4 font-medium">XXL</td><td class="py-2 pr-4">100-104</td><td class="py-2 pr-4">80-84</td><td class="py-2">106-110</td></tr>
                        </tbody>
                      </table>
                    </div>
                    <p class="text-nova-gray text-xs mt-2">*Medidas aproximadas. Si tienes dudas, contáctanos por WhatsApp.</p>
                  </div>
                }
              </div>

              <!-- Envíos -->
              <div class="border border-nova-blush rounded-lg mb-2">
                <button (click)="toggle('shipping')"
                        class="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-nova-pink transition">
                  <span class="font-medium text-sm text-nova-dark">Envíos</span>
                  <svg [class.rotate-180]="openSection === 'shipping'" class="w-5 h-5 text-nova-gray transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/>
                  </svg>
                </button>
                @if (openSection === 'shipping') {
                  <div class="px-4 pb-3 text-sm leading-relaxed border-t border-nova-blush">
                    <ul class="mt-3 space-y-2 text-nova-gray">
                      <li class="flex items-start gap-2">
                        <span class="text-nova-dark font-semibold mt-0.5">Cali:</span>
                        <span>Tiempo estimado de entrega de <strong class="text-nova-dark">1 a 2 días hábiles</strong>.</span>
                      </li>
                      <li class="flex items-start gap-2">
                        <span class="text-nova-dark font-semibold mt-0.5">Ciudades principales:</span>
                        <span>Tiempo estimado de <strong class="text-nova-dark">3 a 6 días hábiles</strong>.</span>
                      </li>
                      <li class="flex items-start gap-2">
                        <span class="text-nova-dark font-semibold mt-0.5">Otras ciudades:</span>
                        <span>Tiempo estimado de <strong class="text-nova-dark">3 a 8 días hábiles</strong>.</span>
                      </li>
                    </ul>
                    <p class="text-nova-gray text-xs mt-3"><strong class="text-nova-dark">Importante:</strong> Los tiempos de entrega son estimados y pueden variar según la transportadora, la ciudad de destino y las condiciones logísticas. NOVA FIT no controla los tiempos de distribución de las empresas transportadoras.</p>
                  </div>
                }
              </div>

              <!-- Garantía y Cambios -->
              <div class="border border-nova-blush rounded-lg mb-2">
                <button (click)="toggle('warranty')"
                        class="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-nova-pink transition">
                  <span class="font-medium text-sm text-nova-dark">Garantía y Cambios</span>
                  <svg [class.rotate-180]="openSection === 'warranty'" class="w-5 h-5 text-nova-gray transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/>
                  </svg>
                </button>
                @if (openSection === 'warranty') {
                  <div class="px-4 pb-3 text-sm leading-relaxed border-t border-nova-blush">
                    <h4 class="mt-3 font-medium text-nova-dark mb-1">Garantía</h4>
                    <p class="text-nova-gray mb-2">Nuestras prendas cuentan con garantía por defectos de fabricación, como fallas en costuras, telas o confección. Para solicitar una revisión, comunícate con nuestro equipo y envía evidencia fotográfica del defecto.</p>
                    <h4 class="font-medium text-nova-dark mb-1">Cambios de talla o referencia</h4>
                    <p class="text-nova-gray mb-3">Debes solicitarlo dentro de los <strong class="text-nova-dark">8 días calendario</strong> siguientes a la recepción del pedido. Las prendas deben estar sin uso, sin lavar y con sus etiquetas originales. No realizamos cambios en prendas en promoción o con descuento.</p>
                    <a routerLink="/garantias-y-cambios" class="text-nova-dark underline hover:text-nova-rose">Ver política completa de garantías y cambios</a>
                  </div>
                }
              </div>
            </div>
          </div>
        </div>
      </div>
    }
  `,
})
export class ProductDetailComponent implements OnInit {
  product: Product | null = null;
  mainImage: string | null = null;
  selectedSize = '';
  openSection = 'desc';
  private whatsappNumber = '573187016549';

  constructor(private api: ApiService, private route: ActivatedRoute) {}

  ngOnInit() {
    this.route.params.subscribe(params => {
      this.api.getProduct(params['slug']).subscribe(product => {
        this.product = product;
        const main = product.images?.find(i => i.isMain) || product.images?.[0];
        this.mainImage = main?.imageData || null;
      });
    });
  }

  selectSize(size: string) { this.selectedSize = size; }

  toggle(section: string) {
    this.openSection = this.openSection === section ? '' : section;
  }

  buyOnWhatsApp() {
    if (!this.product || !this.selectedSize) return;
    const msg = encodeURIComponent(
      `Hola, me interesa el producto *${this.product.name}* en talla *${this.selectedSize}*. ¿Está disponible?`
    );
    window.open(`https://wa.me/${this.whatsappNumber}?text=${msg}`, '_blank');
  }
}
