import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../../services/api.service';
import { compressImage } from '../../../services/image-compress';
import { Category, ONE_SIZE, Product, ProductColor, ProductImage, ProductSize, SIZE_ORDER } from '../../../models/types';
import { CurrencyPipe } from '@angular/common';
import { RouterLink } from '@angular/router';

/** Colores frecuentes para elegir rápido (el tono se puede ajustar) */
const COMMON_COLORS: ProductColor[] = [
  { name: 'Negro', hex: '#1e1e1e' }, { name: 'Blanco', hex: '#ffffff' }, { name: 'Beige', hex: '#d9c7b0' },
  { name: 'Gris', hex: '#9a9a9a' }, { name: 'Café', hex: '#7b5b45' }, { name: 'Rojo', hex: '#c0392b' },
  { name: 'Vino', hex: '#6d1f2c' }, { name: 'Rosado', hex: '#f2b8c6' }, { name: 'Fucsia', hex: '#d63384' },
  { name: 'Lila', hex: '#b9a3d6' }, { name: 'Azul', hex: '#2f5d9b' }, { name: 'Azul oscuro', hex: '#1f2f4d' },
  { name: 'Verde', hex: '#4f7a4a' }, { name: 'Verde oliva', hex: '#6b6b3a' }, { name: 'Amarillo', hex: '#f2c94c' },
  { name: 'Naranja', hex: '#e67e22' },
];

interface FormImage extends ProductImage { color: string; }

@Component({
    selector: 'app-admin-products',
    imports: [FormsModule, CurrencyPipe, RouterLink],
    template: `
    <div class="w-full">
      <div class="flex items-center justify-between mb-8">
        <h1 class="font-display text-3xl font-bold text-nova-dark">Productos</h1>
        <button (click)="showForm ? resetForm() : openNew()"
                class="bg-nova-dark text-white px-4 py-2 text-sm rounded hover:bg-nova-black transition">
          {{ showForm ? 'Cancelar' : '+ Nuevo Producto' }}
        </button>
      </div>

      @if (showForm) {
        <div class="bg-white border border-nova-blush rounded-lg p-6 mb-8">
          <h2 class="font-semibold text-lg mb-1 text-nova-dark">{{ editingId ? 'Editar' : 'Nuevo' }} Producto</h2>
          <p class="text-xs text-nova-gray mb-4">Los campos con <span class="text-red-600">*</span> son obligatorios.</p>
          <form #pf="ngForm" (ngSubmit)="saveProduct()">
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label class="block text-sm font-medium mb-1">Nombre <span class="text-red-600">*</span></label>
                <input [(ngModel)]="form.name" name="name" (ngModelChange)="autoSlug()" required class="inp">
              </div>
              <div>
                <label class="block text-sm font-medium mb-1">Slug (enlace) <span class="text-red-600">*</span></label>
                <input [(ngModel)]="form.slug" name="slug" (input)="slugTouched = true" required pattern="[a-z0-9-]+" class="inp">
                <p class="text-[11px] text-nova-gray mt-1">Solo minúsculas, números y guiones. Ej: set-brisa</p>
              </div>
              <div>
                <label class="block text-sm font-medium mb-1">Precio (COP) <span class="text-red-600">*</span></label>
                <input type="number" [(ngModel)]="form.price" name="price" required min="1" class="inp">
              </div>
              <div>
                <label class="block text-sm font-medium mb-1">Costo por unidad (COP)</label>
                <input type="number" min="0" [(ngModel)]="form.cost" name="cost" placeholder="Lo que te cuesta producirla" class="inp">
                @if (form.cost && form.price) {
                  <p class="text-xs text-nova-gray mt-1">Ganancia por prenda: {{ form.price - form.cost | currency:'COP':'$':'1.0-0' }} ({{ ((form.price - form.cost) / form.price * 100).toFixed(0) }}%)</p>
                }
              </div>
              <div>
                <label class="block text-sm font-medium mb-1">Categoría <span class="text-red-600">*</span></label>
                <select [(ngModel)]="form.categoryId" name="categoryId" required class="inp">
                  <option value="">Seleccionar...</option>
                  @for (cat of categories; track cat.id) {
                    <option [value]="cat.id">{{ cat.name }}</option>
                  }
                </select>
              </div>
              <div class="flex items-end">
                <label class="flex items-center gap-2 pb-2">
                  <input type="checkbox" [(ngModel)]="form.isActive" name="isActive" class="rounded">
                  <span class="text-sm">Activo (se ve en la tienda)</span>
                </label>
              </div>
              <div class="md:col-span-2">
                <label class="block text-sm font-medium mb-1">Descripción</label>
                <textarea [(ngModel)]="form.description" name="description" rows="3" class="inp"></textarea>
              </div>
            </div>

            <!-- Colores -->
            <div class="mt-6 border-t border-nova-pink pt-5">
              <label class="block text-sm font-medium mb-1">Colores</label>
              <p class="text-xs text-nova-gray mb-3">Si la prenda viene en un solo color puedes dejarlo vacío o poner ese color. Con varios colores, cada color tiene su propio stock por talla y sus fotos.</p>
              <div class="flex flex-wrap gap-2 mb-3">
                @for (c of form.colors; track c.name; let i = $index) {
                  <span class="flex items-center gap-2 border border-nova-blush rounded-full pl-1 pr-2 py-1 text-sm">
                    <input type="color" [(ngModel)]="c.hex" [name]="'hex_' + i" class="w-6 h-6 rounded-full border-0 p-0 cursor-pointer" title="Cambiar el tono">
                    {{ c.name }}
                    <button type="button" (click)="removeColor(i)" class="text-red-500 text-xs ml-1" title="Quitar color">x</button>
                  </span>
                } @empty {
                  <span class="text-xs text-nova-gray">Sin colores (la prenda no maneja colores)</span>
                }
              </div>
              <div class="flex flex-wrap items-center gap-2">
                <select [(ngModel)]="quickColor" name="quickColor" (ngModelChange)="addQuickColor()" class="border border-nova-blush rounded px-2 py-1 text-sm">
                  <option value="">Agregar color frecuente...</option>
                  @for (c of availableCommonColors; track c.name) { <option [value]="c.name">{{ c.name }}</option> }
                </select>
                <span class="text-xs text-nova-gray">o</span>
                <input [(ngModel)]="newColorName" name="newColorName" placeholder="Otro color (ej: Terracota)" maxlength="30"
                       (keydown.enter)="$event.preventDefault(); addCustomColor()" class="border border-nova-blush rounded px-2 py-1 text-sm w-48">
                <input type="color" [(ngModel)]="newColorHex" name="newColorHex" class="w-8 h-8 border border-nova-blush rounded p-0.5">
                <button type="button" (click)="addCustomColor()" [disabled]="!newColorName.trim()"
                        class="bg-nova-pink px-3 py-1 rounded text-sm hover:bg-nova-blush transition text-nova-dark disabled:opacity-40">Agregar</button>
              </div>
            </div>

            <!-- Fotos -->
            <div class="mt-6 border-t border-nova-pink pt-5">
              <label class="block text-sm font-medium mb-1">Fotos</label>
              @if (form.colors.length) {
                <p class="text-xs text-nova-gray mb-2">Indica a qué color pertenece cada foto: en la tienda, al elegir un color se muestran sus fotos. "Todos" = se ve con cualquier color.</p>
              }
              <input type="file" accept="image/jpeg,image/png,image/webp" multiple (change)="onImagesSelected($event)"
                      class="block w-full text-sm text-nova-gray file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-nova-pink file:text-nova-dark hover:file:bg-nova-blush">
              <div class="flex flex-wrap gap-3 mt-3">
                @for (img of form.images; track img; let i = $index) {
                  <div class="relative w-24">
                    <img [src]="img.imageData" class="w-24 h-24 object-cover rounded border border-nova-blush">
                    <button type="button" (click)="removeImage(i)"
                            class="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-5 h-5 text-xs flex items-center justify-center">x</button>
                    <button type="button" (click)="setMainImage(i)"
                            [class.bg-nova-sand]="img.isMain" [class.bg-nova-pink]="!img.isMain"
                            class="block mt-1 text-[10px] px-2 py-0.5 rounded w-full text-center">
                      {{ img.isMain ? 'Principal' : 'Secundaria' }}
                    </button>
                    @if (form.colors.length) {
                      <select [(ngModel)]="img.color" [name]="'imgColor_' + i" class="mt-1 w-full border border-nova-blush rounded px-1 py-0.5 text-[11px]">
                        <option value="">Todos</option>
                        @for (c of form.colors; track c.name) { <option [value]="c.name">{{ c.name }}</option> }
                      </select>
                    }
                  </div>
                }
              </div>
            </div>

            <!-- Tallas y stock -->
            <div class="mt-6 border-t border-nova-pink pt-5">
              <label class="block text-sm font-medium mb-1">Tallas y stock <span class="text-red-600">*</span></label>
              <label class="flex items-center gap-2 text-sm mb-3">
                <input type="checkbox" [ngModel]="isOneSize" (ngModelChange)="setOneSize($event)" name="oneSize" class="rounded">
                Talla única (la prenda no maneja tallas)
              </label>
              @if (!isOneSize) {
                <div class="flex flex-wrap gap-2 mb-3">
                  @for (s of allSizes; track s) {
                    <button type="button" (click)="toggleSize(s)"
                            [class.bg-nova-dark]="form.sizeList.includes(s)" [class.text-white]="form.sizeList.includes(s)"
                            class="border border-nova-dark px-3 py-1 text-sm rounded transition">{{ s }}</button>
                  }
                  <input [(ngModel)]="customSize" name="customSize" placeholder="Otra (ej: 6-8)" maxlength="20"
                         (keydown.enter)="$event.preventDefault(); addCustomSize()" class="border border-nova-blush rounded px-2 py-1 text-sm w-28">
                  <button type="button" (click)="addCustomSize()" [disabled]="!customSize.trim()" class="text-sm underline disabled:opacity-40">Agregar</button>
                </div>
              }
              @if (editingId) {
                <p class="text-xs text-nova-gray mb-2">El stock de lo que ya existe se maneja en <a routerLink="/admin/inventario" class="underline">Inventario</a> (entradas, salidas y conteos). Aquí solo pones el stock inicial de colores o tallas nuevas.</p>
              }
              @if (form.sizeList.length) {
                <div class="overflow-x-auto">
                  <table class="text-sm">
                    <thead>
                      <tr>
                        <th class="text-left pr-3 py-1 font-medium text-nova-gray">{{ form.colors.length ? 'Color' : '' }}</th>
                        @for (s of form.sizeList; track s) { <th class="px-1 py-1 font-medium text-nova-dark">{{ s }}</th> }
                      </tr>
                    </thead>
                    <tbody>
                      @for (color of colorRows; track color) {
                        <tr>
                          <td class="pr-3 py-1 whitespace-nowrap">
                            @if (color) { <span class="inline-block w-3 h-3 rounded-full border border-nova-blush align-middle mr-1" [style.background]="hexOf(color)"></span>{{ color }} }
                            @else { <span class="text-nova-gray">Stock</span> }
                          </td>
                          @for (s of form.sizeList; track s) {
                            <td class="px-1 py-1">
                              @if (existing(color, s); as ex) {
                                <span class="block w-16 px-2 py-1 text-center text-nova-gray bg-nova-cream border border-nova-blush rounded" title="Se cambia en Inventario">{{ ex.stock }}</span>
                              } @else {
                                <input type="number" min="0" [ngModel]="stockOf(color, s)" (ngModelChange)="setStock(color, s, $event)"
                                       [name]="'stock_' + color + '_' + s" class="w-16 border border-nova-blush rounded px-2 py-1 text-center">
                              }
                            </td>
                          }
                        </tr>
                      }
                    </tbody>
                  </table>
                </div>
              } @else {
                <p class="text-xs text-red-600">Elige al menos una talla o marca "Talla única".</p>
              }
            </div>

            @if (error) { <div class="bg-red-50 text-red-600 p-3 rounded mt-4 text-sm">{{ error }}</div> }
            <button type="submit" [disabled]="pf.invalid || !form.sizeList.length || !form.price || saving"
                    class="mt-6 bg-nova-dark text-white px-6 py-2 text-sm rounded hover:bg-opacity-90 transition disabled:opacity-50 disabled:cursor-not-allowed">
              {{ saving ? 'Guardando...' : (editingId ? 'Actualizar' : 'Crear') }}
            </button>
            @if (pf.invalid || !form.sizeList.length) {
              <span class="ml-3 text-xs text-nova-gray">Completa los campos obligatorios (*) para guardar.</span>
            }
          </form>
        </div>
      }

      <div class="bg-white border border-nova-blush rounded-lg overflow-x-auto">
        <table class="w-full">
          <thead class="bg-nova-cream">
            <tr>
              <th class="text-left px-6 py-3 text-sm font-medium text-nova-gray">Producto</th>
              <th class="text-left px-6 py-3 text-sm font-medium text-nova-gray">Categoría</th>
              <th class="text-left px-6 py-3 text-sm font-medium text-nova-gray">Precio</th>
              <th class="text-left px-6 py-3 text-sm font-medium text-nova-gray">Stock</th>
              <th class="text-left px-6 py-3 text-sm font-medium text-nova-gray">Estado</th>
              <th class="text-right px-6 py-3 text-sm font-medium text-nova-gray">Acciones</th>
            </tr>
          </thead>
          <tbody>
            @for (prod of products; track prod.id) {
              <tr class="border-t border-nova-pink">
                <td class="px-6 py-3">
                  <div class="flex items-center gap-3">
                    <div class="w-11 h-14 shrink-0 rounded-md overflow-hidden bg-nova-pink">
                      @if (mainImage(prod); as img) {
                        <img [src]="img" [alt]="prod.name" loading="lazy" class="w-full h-full object-cover">
                      } @else {
                        <span class="w-full h-full flex items-center justify-center text-[10px] text-nova-gray">Sin foto</span>
                      }
                    </div>
                    <div>
                      <span class="text-sm font-medium text-nova-dark">{{ prod.name }}</span>
                      @if (prod.colors?.length) {
                        <span class="flex gap-1 mt-1">
                          @for (c of prod.colors; track c.name) {
                            <span class="w-3 h-3 rounded-full border border-nova-blush" [style.background]="c.hex" [title]="c.name"></span>
                          }
                        </span>
                      }
                    </div>
                  </div>
                </td>
                <td class="px-6 py-4 text-sm text-nova-gray">{{ prod.category?.name }}</td>
                <td class="px-6 py-4 text-sm whitespace-nowrap">{{ prod.price | currency:'COP':'$':'1.0-0' }} COP</td>
                <td class="px-6 py-4">
                  <div class="flex flex-wrap gap-1">
                    @for (s of sortedSizes(prod); track (s.color || '') + s.size) {
                      <span class="text-[11px] px-1.5 py-0.5 rounded border tabular-nums whitespace-nowrap"
                            [class.border-red-200]="s.stock <= 0" [class.bg-red-50]="s.stock <= 0" [class.text-red-700]="s.stock <= 0"
                            [class.border-nova-blush]="s.stock > 0" [class.text-nova-gray]="s.stock > 0">{{ s.color ? s.color + ' ' : '' }}{{ s.size }} · {{ s.stock }}</span>
                    }
                  </div>
                </td>
                <td class="px-6 py-4">
                  <span [class.bg-green-100]="prod.isActive" [class.text-green-700]="prod.isActive"
                        [class.bg-red-100]="!prod.isActive" [class.text-red-700]="!prod.isActive"
                        class="px-2 py-1 rounded text-xs font-medium">
                    {{ prod.isActive ? 'Activo' : 'Inactivo' }}
                  </span>
                </td>
                <td class="px-6 py-4 text-right whitespace-nowrap">
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
    styles: [`
    .inp { @apply w-full border border-nova-blush rounded px-3 py-2 focus:outline-none focus:border-nova-rose; }
    .inp.ng-invalid.ng-touched { @apply border-red-400; }
  `]
})
export class AdminProductsComponent implements OnInit {
  categories: Category[] = [];
  products: Product[] = [];
  showForm = false;
  editingId: number | null = null;
  saving = false;
  error = '';
  allSizes = SIZE_ORDER.filter(s => s !== ONE_SIZE);

  quickColor = '';
  newColorName = '';
  newColorHex = '#cccccc';
  customSize = '';

  form = this.emptyForm();
  /** Stock inicial de las variantes nuevas, por "color|talla" */
  private stockDraft: Record<string, number> = {};
  /** Variantes que ya existen en la base (su stock se cambia en Inventario) */
  private existingVariants: ProductSize[] = [];
  slugTouched = false;

  constructor(private api: ApiService) {}

  ngOnInit() {
    this.api.getCategories().subscribe(cats => this.categories = cats);
    this.loadProducts();
  }

  emptyForm() {
    return {
      name: '', slug: '', description: '', price: 0 as number, cost: null as number | null,
      categoryId: '' as number | string, isActive: true,
      colors: [] as ProductColor[], images: [] as FormImage[], sizeList: [] as string[],
    };
  }

  loadProducts() { this.api.getAllProducts().subscribe(prods => this.products = prods); }

  openNew() {
    this.resetForm();
    this.showForm = true;
  }

  // ----- Slug automático a partir del nombre (hasta que lo editen a mano) -----
  autoSlug() {
    if (this.editingId || this.slugTouched) return;
    this.form.slug = this.form.name
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  }

  // ----- Colores -----
  get availableCommonColors() {
    const used = this.form.colors.map(c => c.name.toLowerCase());
    return COMMON_COLORS.filter(c => !used.includes(c.name.toLowerCase()));
  }

  get colorRows(): string[] {
    return this.form.colors.length ? this.form.colors.map(c => c.name) : [''];
  }

  hexOf(color: string) { return this.form.colors.find(c => c.name === color)?.hex || '#ccc'; }

  addQuickColor() {
    const c = COMMON_COLORS.find(x => x.name === this.quickColor);
    if (c) this.addColor(c.name, c.hex);
    setTimeout(() => (this.quickColor = ''));
  }

  addCustomColor() {
    this.addColor(this.newColorName, this.newColorHex);
    this.newColorName = '';
    this.newColorHex = '#cccccc';
  }

  private addColor(name: string, hex: string) {
    name = name.trim().slice(0, 30);
    if (!name || this.form.colors.some(c => c.name.toLowerCase() === name.toLowerCase())) return;
    // Si la prenda no manejaba colores, el stock que ya tenía queda en el primer color nuevo
    if (!this.form.colors.length) {
      for (const key of Object.keys(this.stockDraft)) {
        if (key.startsWith('|')) this.stockDraft[name + key] = this.stockDraft[key];
      }
    }
    this.form.colors.push({ name, hex });
  }

  removeColor(i: number) {
    const color = this.form.colors[i];
    const units = this.existingVariants.filter(v => v.color === color.name).reduce((n, v) => n + v.stock, 0);
    if (units > 0 && !confirm(`El color ${color.name} todavía tiene ${units} unidades en inventario. ¿Quitarlo de la prenda?`)) return;
    this.form.colors.splice(i, 1);
    this.form.images.forEach(img => { if (img.color === color.name) img.color = ''; });
  }

  // ----- Tallas -----
  get isOneSize() { return this.form.sizeList.length === 1 && this.form.sizeList[0] === ONE_SIZE; }

  setOneSize(on: boolean) {
    if (on) {
      const withStock = this.existingVariants.filter(v => v.size !== ONE_SIZE && v.stock > 0);
      if (withStock.length && !confirm('Las tallas actuales tienen unidades en inventario. ¿Cambiar a talla única?')) return;
      this.form.sizeList = [ONE_SIZE];
    } else {
      this.form.sizeList = [];
    }
  }

  toggleSize(size: string) {
    const list = this.form.sizeList;
    if (list.includes(size)) {
      const units = this.existingVariants.filter(v => v.size === size).reduce((n, v) => n + v.stock, 0);
      if (units > 0 && !confirm(`La talla ${size} todavía tiene ${units} unidades. ¿Quitarla de la prenda?`)) return;
      this.form.sizeList = list.filter(s => s !== size);
    } else {
      this.form.sizeList = this.sortSizes([...list.filter(s => s !== ONE_SIZE), size]);
    }
  }

  addCustomSize() {
    const size = this.customSize.trim().slice(0, 20);
    if (size && !this.form.sizeList.includes(size)) {
      this.form.sizeList = this.sortSizes([...this.form.sizeList.filter(s => s !== ONE_SIZE), size]);
    }
    this.customSize = '';
  }

  private sortSizes(sizes: string[]) {
    const rank = (s: string) => SIZE_ORDER.indexOf(s) + 1 || 99;
    return [...sizes].sort((a, b) => rank(a) - rank(b));
  }

  existing(color: string, size: string) {
    return this.existingVariants.find(v => (v.color || '') === color && v.size === size) || null;
  }

  stockOf(color: string, size: string) { return this.stockDraft[`${color}|${size}`] ?? 0; }
  setStock(color: string, size: string, value: number) { this.stockDraft[`${color}|${size}`] = Math.max(0, Number(value) || 0); }

  // ----- Fotos -----
  async onImagesSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (!input.files) return;
    const images = await Promise.all(Array.from(input.files).map(file => compressImage(file, 1400)));
    for (const imageData of images) {
      const isMain = this.form.images.length === 0;
      this.form.images.push({ imageData, mimeType: 'image/jpeg', isMain, color: '' });
    }
    input.value = '';
  }

  removeImage(index: number) {
    this.form.images.splice(index, 1);
    if (this.form.images.length > 0 && !this.form.images.some(i => i.isMain)) {
      this.form.images[0].isMain = true;
    }
  }

  setMainImage(index: number) {
    this.form.images.forEach((img, i) => img.isMain = i === index);
  }

  // ----- Listado -----
  mainImage(prod: Product): string | null {
    const img = prod.images?.find(i => i.isMain) || prod.images?.[0];
    return img?.imageData || null;
  }

  sortedSizes(prod: Product): ProductSize[] {
    const colorRank = (c?: string) => (prod.colors || []).findIndex(x => x.name === c);
    const rank = (s: string) => SIZE_ORDER.indexOf(s) + 1 || 99;
    return [...(prod.sizes || [])].sort((a, b) => colorRank(a.color) - colorRank(b.color) || rank(a.size) - rank(b.size));
  }

  editProduct(prod: Product) {
    this.resetForm();
    this.editingId = prod.id;
    this.existingVariants = (prod.sizes || []).map(s => ({ ...s, color: s.color || '' }));
    this.form = {
      name: prod.name, slug: prod.slug, description: prod.description || '',
      price: Number(prod.price), cost: prod.cost != null ? Number(prod.cost) : null, categoryId: prod.categoryId, isActive: prod.isActive,
      colors: (prod.colors || []).map(c => ({ ...c })),
      images: prod.images?.map(i => ({ ...i, color: i.color || '' })) || [],
      sizeList: this.sortSizes([...new Set(this.existingVariants.map(s => s.size))]),
    };
    this.showForm = true;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  saveProduct() {
    if (!this.form.sizeList.length) { this.error = 'Elige al menos una talla o marca "Talla única"'; return; }
    // Variantes = cada color (o ninguno) × cada talla
    const sizes = this.colorRows.flatMap(color =>
      this.form.sizeList.map(size => ({ color, size, stock: this.existing(color, size)?.stock ?? this.stockOf(color, size) }))
    );
    const data = { ...this.form, categoryId: Number(this.form.categoryId), sizes };
    delete (data as any).sizeList;
    this.saving = true;
    this.error = '';
    const request = this.editingId ? this.api.updateProduct(this.editingId, data) : this.api.createProduct(data);
    request.subscribe({
      next: () => { this.resetForm(); this.loadProducts(); },
      error: err => { this.saving = false; this.error = err?.error?.message || 'No se pudo guardar el producto'; },
    });
  }

  deleteProduct(id: number) {
    if (confirm('¿Eliminar este producto?')) {
      this.api.deleteProduct(id).subscribe(() => this.loadProducts());
    }
  }

  resetForm() {
    this.showForm = false;
    this.editingId = null;
    this.saving = false;
    this.error = '';
    this.stockDraft = {};
    this.existingVariants = [];
    this.slugTouched = false;
    this.form = this.emptyForm();
  }
}
