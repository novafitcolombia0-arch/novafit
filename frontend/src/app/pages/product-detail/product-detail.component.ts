import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { combineLatest } from 'rxjs';
import { ApiService } from '../../services/api.service';
import { ONE_SIZE, Product, ProductImage, ProductSize, SIZE_ORDER } from '../../models/types';
import { CurrencyPipe } from '@angular/common';
import { CartService } from '../../services/cart.service';

@Component({
    selector: 'app-product-detail',
    imports: [RouterLink, CurrencyPipe],
    template: `
    @if (product) {
      <div class="max-w-6xl mx-auto px-4 py-6">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <div class="bg-nova-pink rounded-lg overflow-hidden aspect-[3/4] mb-3 cursor-zoom-in">
              @if (mainImage) {
                <img [src]="mainImage" [alt]="product.name + (selectedColor ? ' ' + selectedColor : '')" class="w-full h-full object-cover transition-transform duration-500 ease-out hover:scale-110">
              } @else {
                <div class="flex items-center justify-center h-full text-nova-gray">Sin imagen</div>
              }
            </div>
            @if (visibleImages.length > 1) {
              <div class="flex flex-wrap gap-1.5">
                @for (img of visibleImages; track img.id) {
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

            @if (colors.length) {
              <div class="mb-4">
                <p class="text-sm font-medium mb-2 text-nova-dark">Color: <span class="font-normal text-nova-gray">{{ selectedColor }}</span></p>
                <div class="flex flex-wrap gap-2">
                  @for (c of colors; track c.name) {
                    <button (click)="selectColor(c.name)" [title]="c.name" [attr.aria-label]="c.name"
                            [class.ring-2]="selectedColor === c.name" [class.ring-nova-dark]="selectedColor === c.name"
                            [class.opacity-40]="!colorHasStock(c.name)"
                            class="w-8 h-8 rounded-full border border-nova-blush ring-offset-2 transition"
                            [style.background]="c.hex"></button>
                  }
                </div>
              </div>
            }

            @if (isOneSize) {
              <p class="text-sm text-nova-dark mb-4">Talla única
                @if (sizesForColor[0]?.stock! <= 0) { <span class="text-red-600">· agotada</span> }
              </p>
            } @else {
              <div class="mb-4">
                <p class="text-sm font-medium mb-2 text-nova-dark">Talla:</p>
                <div class="flex flex-wrap gap-2">
                  @for (s of sizesForColor; track s.id) {
                    <button (click)="selectSize(s.size)" [disabled]="s.stock <= 0"
                            [class.bg-nova-dark]="selectedSize === s.size"
                            [class.text-white]="selectedSize === s.size"
                            [class.border-nova-dark]="selectedSize !== s.size"
                            [class.opacity-40]="s.stock <= 0"
                            class="border border-nova-blush px-3 py-1.5 text-sm rounded transition">{{ s.size }}</button>
                  }
                </div>
              </div>
            }

            <button (click)="addToCart()" [disabled]="!canAdd"
                    class="w-full bg-nova-dark text-white py-3 rounded-lg font-medium text-sm uppercase tracking-wider hover:bg-nova-black transition disabled:opacity-50 disabled:cursor-not-allowed mb-2">
              {{ soldOut ? 'Agotado' : 'Agregar a la bolsa' }}
            </button>

            @if (added) {
              <div class="flex items-center justify-between bg-nova-pink text-sm text-nova-dark rounded-lg px-4 py-3 mb-2">
                <span>Agregado a tu bolsa</span>
                <a routerLink="/carrito" class="font-medium underline">Ver bolsa y pagar</a>
              </div>
            }

            @if (!canAdd && !soldOut) {
              <p class="text-center text-nova-gray text-xs mt-1">{{ colors.length && !selectedColor ? 'Selecciona un color' : 'Selecciona una talla' }}</p>
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
  `
})
export class ProductDetailComponent implements OnInit {
  product: Product | null = null;
  mainImage: string | null = null;
  selectedColor = '';
  selectedSize = '';
  openSection = 'desc';
  added = false;

  constructor(private api: ApiService, private route: ActivatedRoute, private cart: CartService) {}

  ngOnInit() {
    // ?color=Rojo llega desde los circulitos de color del catálogo
    combineLatest([this.route.params, this.route.queryParams]).subscribe(([params, query]) => {
      this.api.getProduct(params['slug']).subscribe(product => {
        this.product = product;
        this.selectedSize = '';
        this.added = false;
        const wanted = this.colors.find(c => c.name === query['color'])?.name;
        const firstAvailable = this.colors.find(c => this.colorHasStock(c.name))?.name;
        this.selectColor(wanted || firstAvailable || this.colors[0]?.name || '');
      });
    });
  }

  get colors() { return this.product?.colors || []; }

  /** Variantes del color elegido (o todas si la prenda no maneja colores), en orden de talla */
  get sizesForColor(): ProductSize[] {
    const rank = (s: string) => SIZE_ORDER.indexOf(s) + 1 || 99;
    return (this.product?.sizes || [])
      .filter(s => (s.color || '') === this.selectedColor)
      .sort((a, b) => rank(a.size) - rank(b.size));
  }

  get isOneSize() {
    const sizes = this.sizesForColor;
    return sizes.length === 1 && sizes[0].size === ONE_SIZE;
  }

  /** Fotos del color elegido más las que sirven para todos los colores */
  get visibleImages(): ProductImage[] {
    const images = this.product?.images || [];
    if (!this.selectedColor) return images;
    const forColor = images.filter(i => !i.color || i.color === this.selectedColor);
    return forColor.length ? forColor : images;
  }

  get soldOut() { return this.sizesForColor.every(s => s.stock <= 0); }

  get canAdd() {
    const variant = this.sizesForColor.find(s => s.size === this.selectedSize);
    return !!variant && variant.stock > 0;
  }

  colorHasStock(color: string) {
    return (this.product?.sizes || []).some(s => (s.color || '') === color && s.stock > 0);
  }

  selectColor(color: string) {
    this.selectedColor = color;
    this.added = false;
    // La foto principal: primero una propia del color, si no la principal general
    const images = this.visibleImages;
    const main = images.find(i => i.color === color && i.isMain) || images.find(i => i.color === color)
      || images.find(i => i.isMain) || images[0];
    this.mainImage = main?.imageData || null;
    // Se conserva la talla si existe en el nuevo color; con talla única se elige sola
    const sizes = this.sizesForColor;
    if (this.isOneSize) this.selectedSize = sizes[0].size;
    else if (!sizes.some(s => s.size === this.selectedSize && s.stock > 0)) this.selectedSize = '';
  }

  selectSize(size: string) { this.selectedSize = size; this.added = false; }

  addToCart() {
    if (!this.product || !this.canAdd) return;
    this.cart.add(this.product, this.selectedColor, this.selectedSize, this.mainImage);
    this.added = true;
  }

  toggle(section: string) {
    this.openSection = this.openSection === section ? '' : section;
  }
}
