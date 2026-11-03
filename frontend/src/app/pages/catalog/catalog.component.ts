import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ApiService } from '../../services/api.service';
import { Category, Product } from '../../models/types';
import { CurrencyPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-catalog',
  standalone: true,
  imports: [RouterLink, CurrencyPipe, FormsModule],
  template: `
    <div class="max-w-7xl mx-auto px-4 py-8">
      <h1 class="font-display text-3xl font-bold mb-8 text-nova-dark">Tienda</h1>

      <div class="flex flex-wrap gap-3 mb-8">
        <button (click)="filterByCategory(null)"
                [class.bg-nova-dark]="!selectedCategoryId" [class.text-white]="!selectedCategoryId"
                [class.bg-nova-pink]="!!selectedCategoryId" [class.text-nova-dark]="!!selectedCategoryId"
                class="px-4 py-2 text-sm uppercase tracking-wider rounded-full transition">Todos</button>
        @for (cat of categories; track cat.id) {
          <button (click)="filterByCategory(cat.id)"
                  [class.bg-nova-dark]="selectedCategoryId === cat.id" [class.text-white]="selectedCategoryId === cat.id"
                  [class.bg-nova-pink]="selectedCategoryId !== cat.id" [class.text-nova-dark]="selectedCategoryId !== cat.id"
                  class="px-4 py-2 text-sm uppercase tracking-wider rounded-full transition flex items-center gap-2">
            @if (cat.image) {
              <img [src]="cat.image" class="w-5 h-5 rounded-full object-cover">
            }
            {{ cat.name }}
          </button>
        }
      </div>

      <input type="text" [(ngModel)]="searchTerm" (ngModelChange)="onSearch()"
             placeholder="Buscar productos..."
             class="w-full md:w-96 border border-nova-blush rounded-lg px-4 py-3 mb-8 focus:outline-none focus:border-nova-rose bg-white">

      @if (products.length === 0) {
        <div class="text-center py-16 text-nova-gray">No se encontraron productos</div>
      }

      <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
        @for (product of products; track product.id) {
          <a [routerLink]="['/producto', product.slug]" class="group cursor-pointer">
            <div class="bg-nova-pink rounded-lg overflow-hidden aspect-[3/4] mb-3 flex items-center justify-center">
              @if (getMainImage(product)) {
                <img [src]="getMainImage(product)" [alt]="product.name" class="w-full h-full object-cover">
              } @else {
                <span class="text-nova-gray text-sm">Sin imagen</span>
              }
            </div>
            <div class="flex gap-1 mb-2">
              @for (s of product.sizes; track s.id) {
                <span class="text-[10px] text-nova-gray border border-nova-blush px-1 rounded">{{ s.size }}</span>
              }
            </div>
            <h3 class="font-medium text-sm group-hover:text-nova-rose transition text-nova-dark">{{ product.name }}</h3>
            <p class="text-nova-gray text-sm mt-1">{{ product.price | currency:'COP':'symbol':'1.0-0' }}</p>
          </a>
        }
      </div>
    </div>
  `,
})
export class CatalogComponent implements OnInit {
  categories: Category[] = [];
  products: Product[] = [];
  selectedCategoryId: number | null = null;
  searchTerm = '';

  constructor(private api: ApiService, private route: ActivatedRoute) {}

  ngOnInit() {
    this.api.getCategories().subscribe(cats => this.categories = cats.filter(c => c.isActive));
    this.route.queryParams.subscribe(params => {
      if (params['categoria']) {
        this.api.getCategories().subscribe(cats => {
          const cat = cats.find(c => c.slug === params['categoria']);
          if (cat) this.filterByCategory(cat.id);
        });
      } else {
        this.loadProducts();
      }
    });
  }

  loadProducts() {
    this.api.getProducts(this.selectedCategoryId || undefined, this.searchTerm || undefined)
      .subscribe(prods => this.products = prods);
  }

  filterByCategory(id: number | null) { this.selectedCategoryId = id; this.loadProducts(); }
  onSearch() { this.loadProducts(); }

  getMainImage(product: Product): string | null {
    const main = product.images?.find(i => i.isMain) || product.images?.[0];
    return main ? main.imageData : null;
  }
}
