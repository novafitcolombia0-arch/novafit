import { Component, OnInit, OnDestroy } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ApiService } from '../../services/api.service';
import { Category, Product } from '../../models/types';
import { CurrencyPipe } from '@angular/common';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [RouterLink, CurrencyPipe],
  template: `
    <section class="relative text-white overflow-hidden h-[500px] md:h-[600px]">
      @if (heroImages.length > 0) {
        <img [src]="heroImages[currentSlide]" class="absolute inset-0 w-full h-full object-cover transition-opacity duration-700">
        <div class="absolute inset-0 bg-black bg-opacity-30"></div>

        <button (click)="prev()"
                class="absolute left-4 top-1/2 -translate-y-1/2 bg-white bg-opacity-20 hover:bg-opacity-40 text-white w-10 h-10 rounded-full flex items-center justify-center transition">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/>
          </svg>
        </button>
        <button (click)="next()"
                class="absolute right-4 top-1/2 -translate-y-1/2 bg-white bg-opacity-20 hover:bg-opacity-40 text-white w-10 h-10 rounded-full flex items-center justify-center transition">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/>
          </svg>
        </button>

        <div class="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-2">
          @for (img of heroImages; track $index) {
            <button (click)="goTo($index)"
                    [class.bg-white]="currentSlide === $index"
                    [class.bg-white.bg-opacity-50]="currentSlide !== $index"
                    class="w-2.5 h-2.5 rounded-full transition">
            </button>
          }
        </div>
      } @else {
        <div class="absolute inset-0 bg-nova-dark"></div>
      }

      <div class="relative max-w-7xl mx-auto px-4 h-full flex flex-col items-center justify-center text-center">
        <h1 class="font-display text-5xl md:text-7xl font-bold mb-4 tracking-wide">NOVA</h1>
        <p class="text-lg md:text-xl text-nova-blush mb-8 tracking-widest uppercase">Moda Femenina</p>
        <p class="text-nova-blush mb-8 max-w-md mx-auto">Descubre nuestra colección exclusiva de ropa femenina con estilo y elegancia.</p>
        <a routerLink="/catalogo" class="inline-block bg-nova-dark text-white px-8 py-3 text-sm uppercase tracking-widest hover:bg-opacity-90 transition">Ver Colección</a>
      </div>
    </section>

    <section class="max-w-7xl mx-auto px-4 py-16">
      <h2 class="font-display text-3xl font-bold text-center mb-12 text-nova-dark">Categorías</h2>
      <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
        @for (cat of categories; track cat.id) {
          <a [routerLink]="['/catalogo']" [queryParams]="{categoria: cat.slug}"
             class="group relative rounded-lg overflow-hidden aspect-square">
            @if (cat.image) {
              <img [src]="cat.image" [alt]="cat.name" class="absolute inset-0 w-full h-full object-cover">
              <div class="absolute inset-0 bg-black bg-opacity-30 group-hover:bg-opacity-50 transition"></div>
              <span class="absolute inset-0 flex items-center justify-center text-white text-lg font-semibold group-hover:text-nova-sand transition">{{ cat.name }}</span>
            } @else {
              <div class="absolute inset-0 bg-nova-blush flex items-center justify-center">
                <span class="text-lg font-semibold text-nova-dark group-hover:text-nova-rose transition">{{ cat.name }}</span>
              </div>
            }
          </a>
        }
      </div>
    </section>

    <section class="max-w-7xl mx-auto px-4 py-16">
      <h2 class="font-display text-3xl font-bold text-center mb-4 text-nova-dark">Nuevos Lanzamientos</h2>
      <p class="text-center text-nova-gray mb-12">Lo más reciente de nuestra colección</p>
      <div class="grid grid-cols-2 md:grid-cols-4 gap-6">
        @for (product of products; track product.id) {
          <a [routerLink]="['/producto', product.slug]" class="group cursor-pointer">
            <div class="bg-nova-pink rounded-lg overflow-hidden aspect-[3/4] mb-3 flex items-center justify-center">
              @if (getMainImage(product)) {
                <img [src]="getMainImage(product)" [alt]="product.name" class="w-full h-full object-cover">
              } @else {
                <span class="text-nova-gray text-sm">Sin imagen</span>
              }
            </div>
            <h3 class="font-medium text-sm group-hover:text-nova-rose transition text-nova-dark">{{ product.name }}</h3>
            <p class="text-nova-gray text-sm mt-1">{{ product.price | currency:'COP':'symbol':'1.0-0' }}</p>
          </a>
        }
      </div>
      <div class="text-center mt-8">
        <a routerLink="/catalogo" class="inline-block border border-nova-dark text-nova-dark px-8 py-3 text-sm uppercase tracking-widest hover:bg-nova-black hover:text-white transition">Ver Todo</a>
      </div>
    </section>
  `,
})
export class HomeComponent implements OnInit, OnDestroy {
  categories: Category[] = [];
  products: Product[] = [];
  heroImages: string[] = [];
  currentSlide = 0;
  private intervalId: any;

  constructor(private api: ApiService) {}

  ngOnInit() {
    this.api.getCategories().subscribe(cats => this.categories = cats.filter(c => c.isActive));
    this.api.getProducts().subscribe(prods => this.products = prods.slice(0, 8));
    this.api.getSettings().subscribe(settings => {
      if (settings['heroImages']) {
        try {
          this.heroImages = JSON.parse(settings['heroImages']);
          if (this.heroImages.length > 0) this.startAutoplay();
        } catch { this.heroImages = []; }
      }
    });
  }

  ngOnDestroy() {
    if (this.intervalId) clearInterval(this.intervalId);
  }

  startAutoplay() { this.intervalId = setInterval(() => this.next(), 5000); }
  next() { this.currentSlide = (this.currentSlide + 1) % this.heroImages.length; }
  prev() { this.currentSlide = (this.currentSlide - 1 + this.heroImages.length) % this.heroImages.length; }
  goTo(index: number) { this.currentSlide = index; }

  getMainImage(product: Product): string | null {
    const main = product.images?.find(i => i.isMain) || product.images?.[0];
    return main ? main.imageData : null;
  }
}
