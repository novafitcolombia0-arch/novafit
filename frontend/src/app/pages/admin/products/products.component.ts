import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../../services/api.service';
import { Category, Product, ProductImage, ProductSize } from '../../../models/types';
import { CurrencyPipe } from '@angular/common';

@Component({
  selector: 'app-admin-products',
  standalone: true,
  imports: [FormsModule, CurrencyPipe],
  template: `
    <div class="max-w-7xl mx-auto px-4 py-8">
      <div class="flex items-center justify-between mb-8">
        <h1 class="font-display text-3xl font-bold text-nova-dark">Productos</h1>
        <button (click)="showForm = !showForm"
                class="bg-nova-dark text-white px-4 py-2 text-sm rounded hover:bg-nova-black transition">
          {{ showForm ? 'Cancelar' : '+ Nuevo Producto' }}
        </button>
      </div>

      @if (showForm) {
        <div class="bg-white border border-nova-blush rounded-lg p-6 mb-8">
          <h2 class="font-semibold text-lg mb-4 text-nova-dark">{{ editingId ? 'Editar' : 'Nuevo' }} Producto</h2>
          <form (submit)="saveProduct()">
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label class="block text-sm font-medium mb-1">Nombre</label>
                <input [(ngModel)]="form.name" name="name"
                       class="w-full border border-nova-blush rounded px-3 py-2 focus:outline-none focus:border-nova-rose" required>
              </div>
              <div>
                <label class="block text-sm font-medium mb-1">Slug</label>
                <input [(ngModel)]="form.slug" name="slug"
                       class="w-full border border-nova-blush rounded px-3 py-2 focus:outline-none focus:border-nova-rose" required>
              </div>
              <div>
                <label class="block text-sm font-medium mb-1">Precio (COP)</label>
                <input type="number" [(ngModel)]="form.price" name="price"
                       class="w-full border border-nova-blush rounded px-3 py-2 focus:outline-none focus:border-nova-rose" required>
              </div>
              <div>
                <label class="block text-sm font-medium mb-1">Categoría</label>
                <select [(ngModel)]="form.categoryId" name="categoryId"
                        class="w-full border border-nova-blush rounded px-3 py-2 focus:outline-none focus:border-nova-rose" required>
                  <option value="">Seleccionar...</option>
                  @for (cat of categories; track cat.id) {
                    <option [value]="cat.id">{{ cat.name }}</option>
                  }
                </select>
              </div>
              <div class="md:col-span-2">
                <label class="block text-sm font-medium mb-1">Descripción</label>
                <textarea [(ngModel)]="form.description" name="description" rows="3"
                          class="w-full border border-nova-blush rounded px-3 py-2 focus:outline-none focus:border-nova-rose"></textarea>
              </div>
              <div>
                <label class="flex items-center gap-2">
                  <input type="checkbox" [(ngModel)]="form.isActive" name="isActive" class="rounded">
                  <span class="text-sm">Activo</span>
                </label>
              </div>
            </div>

            <div class="mt-6">
              <label class="block text-sm font-medium mb-2">Imágenes</label>
              <input type="file" accept="image/*" multiple (change)="onImagesSelected($event)"
                      class="block w-full text-sm text-nova-gray file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-nova-pink file:text-nova-dark hover:file:bg-nova-blush">
              <div class="flex flex-wrap gap-3 mt-3">
                @for (img of form.images; track img) {
                  <div class="relative">
                    <img [src]="img.imageData" class="w-20 h-20 object-cover rounded border border-nova-blush">
                    <button type="button" (click)="removeImage($index)"
                            class="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-5 h-5 text-xs flex items-center justify-center">x</button>
                    <button type="button" (click)="setMainImage($index)"
                            [class.bg-nova-sand]="img.isMain" [class.bg-nova-pink]="!img.isMain"
                            class="block mt-1 text-[10px] px-2 py-0.5 rounded w-20 text-center">
                      {{ img.isMain ? 'Principal' : 'Secundaria' }}
                    </button>
                  </div>
                }
              </div>
            </div>

            <div class="mt-6">
              <label class="block text-sm font-medium mb-2">Tallas y Stock</label>
              <div class="flex flex-wrap gap-3 items-end">
                @for (s of form.sizes; track s) {
                  <div class="flex items-center gap-1">
                    <span class="text-sm font-medium w-8 text-nova-dark">{{ s.size }}</span>
                    <input type="number" [(ngModel)]="s.stock" [name]="'stock_' + $index" min="0"
                           class="w-20 border border-nova-blush rounded px-2 py-1 text-sm focus:outline-none focus:border-nova-rose">
                    <button type="button" (click)="removeSize($index)" class="text-red-500 text-xs ml-1">x</button>
                  </div>
                }
              </div>
              <div class="flex gap-2 mt-3">
                <select [(ngModel)]="newSize" name="newSize" class="border border-nova-blush rounded px-2 py-1 text-sm">
                  <option value="">Agregar talla...</option>
                  @for (s of availableSizes; track s) {
                    <option [value]="s">{{ s }}</option>
                  }
                </select>
                <button type="button" (click)="addSize()"
                        class="bg-nova-pink px-3 py-1 rounded text-sm hover:bg-nova-blush transition text-nova-dark">Agregar</button>
              </div>
            </div>

            <button type="submit"
                    class="mt-6 bg-nova-dark text-white px-6 py-2 text-sm rounded hover:bg-opacity-90 transition">
              {{ editingId ? 'Actualizar' : 'Crear' }}
            </button>
          </form>
        </div>
      }

      <div class="bg-white border border-nova-blush rounded-lg overflow-hidden">
        <table class="w-full">
          <thead class="bg-nova-cream">
            <tr>
              <th class="text-left px-6 py-3 text-sm font-medium text-nova-gray">Producto</th>
              <th class="text-left px-6 py-3 text-sm font-medium text-nova-gray">Categoría</th>
              <th class="text-left px-6 py-3 text-sm font-medium text-nova-gray">Precio</th>
              <th class="text-left px-6 py-3 text-sm font-medium text-nova-gray">Tallas</th>
              <th class="text-left px-6 py-3 text-sm font-medium text-nova-gray">Estado</th>
              <th class="text-right px-6 py-3 text-sm font-medium text-nova-gray">Acciones</th>
            </tr>
          </thead>
          <tbody>
            @for (prod of products; track prod.id) {
              <tr class="border-t border-nova-pink">
                <td class="px-6 py-4 text-sm font-medium text-nova-dark">{{ prod.name }}</td>
                <td class="px-6 py-4 text-sm text-nova-gray">{{ prod.category?.name }}</td>
                <td class="px-6 py-4 text-sm">{{ prod.price | currency:'COP':'$':'1.0-0' }} COP</td>
                <td class="px-6 py-4 text-xs text-nova-gray">{{ getSizeLabels(prod.sizes) }}</td>
                <td class="px-6 py-4">
                  <span [class.bg-green-100]="prod.isActive" [class.text-green-700]="prod.isActive"
                        [class.bg-red-100]="!prod.isActive" [class.text-red-700]="!prod.isActive"
                        class="px-2 py-1 rounded text-xs font-medium">
                    {{ prod.isActive ? 'Activo' : 'Inactivo' }}
                  </span>
                </td>
                <td class="px-6 py-4 text-right">
                  <button (click)="editProduct(prod)" class="text-nova-rose text-sm mr-3 hover:underline">Editar</button>
                  <button (click)="deleteProduct(prod.id)" class="text-red-600 text-sm">Eliminar</button>
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    </div>
  `,
})
export class AdminProductsComponent implements OnInit {
  categories: Category[] = [];
  products: Product[] = [];
  showForm = false;
  editingId: number | null = null;
  newSize = '';
  allSizes = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];

  form: any = {
    name: '', slug: '', description: '', price: 0,
    categoryId: '', isActive: true, images: [], sizes: []
  };

  constructor(private api: ApiService) {}

  ngOnInit() {
    this.api.getCategories().subscribe(cats => this.categories = cats);
    this.loadProducts();
  }

  get availableSizes(): string[] {
    const used = this.form.sizes.map((s: ProductSize) => s.size);
    return this.allSizes.filter(s => !used.includes(s));
  }

  loadProducts() { this.api.getAllProducts().subscribe(prods => this.products = prods); }

  onImagesSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (!input.files) return;
    Array.from(input.files).forEach(file => {
      const reader = new FileReader();
      reader.onload = () => {
        const isMain = this.form.images.length === 0;
        this.form.images.push({ imageData: reader.result as string, mimeType: file.type, isMain });
      };
      reader.readAsDataURL(file);
    });
  }

  removeImage(index: number) {
    this.form.images.splice(index, 1);
    if (this.form.images.length > 0 && !this.form.images.some((i: ProductImage) => i.isMain)) {
      this.form.images[0].isMain = true;
    }
  }

  setMainImage(index: number) {
    this.form.images.forEach((img: ProductImage, i: number) => img.isMain = i === index);
  }

  addSize() {
    if (this.newSize && !this.form.sizes.find((s: ProductSize) => s.size === this.newSize)) {
      this.form.sizes.push({ size: this.newSize, stock: 0 });
      this.newSize = '';
    }
  }

  removeSize(index: number) { this.form.sizes.splice(index, 1); }

  getSizeLabels(sizes: ProductSize[]): string {
    return sizes?.map(s => `${s.size}(${s.stock})`).join(', ') || '-';
  }

  editProduct(prod: Product) {
    this.editingId = prod.id;
    this.form = {
      name: prod.name, slug: prod.slug, description: prod.description,
      price: prod.price, categoryId: prod.categoryId, isActive: prod.isActive,
      images: prod.images?.map(i => ({ ...i })) || [],
      sizes: prod.sizes?.map(s => ({ ...s })) || [],
    };
    this.showForm = true;
  }

  saveProduct() {
    const data = { ...this.form, categoryId: parseInt(this.form.categoryId) };
    if (this.editingId) {
      this.api.updateProduct(this.editingId, data).subscribe(() => { this.resetForm(); this.loadProducts(); });
    } else {
      this.api.createProduct(data).subscribe(() => { this.resetForm(); this.loadProducts(); });
    }
  }

  deleteProduct(id: number) {
    if (confirm('¿Eliminar este producto?')) {
      this.api.deleteProduct(id).subscribe(() => this.loadProducts());
    }
  }

  resetForm() {
    this.showForm = false;
    this.editingId = null;
    this.form = { name: '', slug: '', description: '', price: 0, categoryId: '', isActive: true, images: [], sizes: [] };
  }
}
