import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../../services/api.service';
import { Category } from '../../../models/types';

@Component({
  selector: 'app-admin-categories',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="max-w-7xl mx-auto px-4 py-8">
      <div class="flex items-center justify-between mb-8">
        <h1 class="font-display text-3xl font-bold text-nova-dark">Categorías</h1>
        <button (click)="showForm = !showForm"
                class="bg-nova-dark text-white px-4 py-2 text-sm rounded hover:bg-nova-black transition">
          {{ showForm ? 'Cancelar' : '+ Nueva Categoría' }}
        </button>
      </div>

      @if (showForm) {
        <div class="bg-white border border-nova-blush rounded-lg p-6 mb-8">
          <h2 class="font-semibold text-lg mb-4 text-nova-dark">{{ editingId ? 'Editar' : 'Nueva' }} Categoría</h2>
          <form (submit)="saveCategory()">
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
              <div class="md:col-span-2">
                <label class="block text-sm font-medium mb-1">Descripción</label>
                <textarea [(ngModel)]="form.description" name="description" rows="2"
                          class="w-full border border-nova-blush rounded px-3 py-2 focus:outline-none focus:border-nova-rose"></textarea>
              </div>
              <div>
                <label class="block text-sm font-medium mb-1">Imagen de categoría</label>
                <input type="file" accept="image/*" (change)="onImageSelected($event)"
                       class="block w-full text-sm text-nova-gray file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-nova-pink file:text-nova-dark hover:file:bg-nova-blush">
                @if (form.image) {
                  <div class="mt-2 relative inline-block">
                    <img [src]="form.image" class="w-32 h-32 object-cover rounded border border-nova-blush">
                    <button type="button" (click)="form.image = ''"
                            class="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-5 h-5 text-xs flex items-center justify-center">x</button>
                  </div>
                }
              </div>
              <div>
                <label class="flex items-center gap-2 mt-6">
                  <input type="checkbox" [(ngModel)]="form.isActive" name="isActive" class="rounded">
                  <span class="text-sm text-nova-dark">Activa</span>
                </label>
              </div>
            </div>
            <button type="submit"
                    class="mt-4 bg-nova-dark text-white px-6 py-2 text-sm rounded hover:bg-opacity-90 transition">
              {{ editingId ? 'Actualizar' : 'Crear' }}
            </button>
          </form>
        </div>
      }

      <div class="bg-white border border-nova-blush rounded-lg overflow-hidden">
        <table class="w-full">
          <thead class="bg-nova-cream">
            <tr>
              <th class="text-left px-6 py-3 text-sm font-medium text-nova-gray">Imagen</th>
              <th class="text-left px-6 py-3 text-sm font-medium text-nova-gray">Nombre</th>
              <th class="text-left px-6 py-3 text-sm font-medium text-nova-gray">Slug</th>
              <th class="text-left px-6 py-3 text-sm font-medium text-nova-gray">Estado</th>
              <th class="text-right px-6 py-3 text-sm font-medium text-nova-gray">Acciones</th>
            </tr>
          </thead>
          <tbody>
            @for (cat of categories; track cat.id) {
              <tr class="border-t border-nova-pink">
                <td class="px-6 py-4">
                  @if (cat.image) {
                    <img [src]="cat.image" class="w-12 h-12 object-cover rounded">
                  } @else {
                    <div class="w-12 h-12 bg-nova-pink rounded flex items-center justify-center text-nova-gray text-xs">Sin img</div>
                  }
                </td>
                <td class="px-6 py-4 text-sm font-medium text-nova-dark">{{ cat.name }}</td>
                <td class="px-6 py-4 text-sm text-nova-gray">{{ cat.slug }}</td>
                <td class="px-6 py-4">
                  <span [class.bg-green-100]="cat.isActive" [class.text-green-700]="cat.isActive"
                        [class.bg-red-100]="!cat.isActive" [class.text-red-700]="!cat.isActive"
                        class="px-2 py-1 rounded text-xs font-medium">
                    {{ cat.isActive ? 'Activa' : 'Inactiva' }}
                  </span>
                </td>
                <td class="px-6 py-4 text-right">
                  <button (click)="editCategory(cat)" class="text-nova-rose text-sm mr-3 hover:underline">Editar</button>
                  <button (click)="deleteCategory(cat.id)" class="text-red-600 text-sm hover:underline">Eliminar</button>
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    </div>
  `,
})
export class AdminCategoriesComponent implements OnInit {
  categories: Category[] = [];
  showForm = false;
  editingId: number | null = null;
  form: Partial<Category> = { name: '', slug: '', description: '', image: '', isActive: true };

  constructor(private api: ApiService) {}
  ngOnInit() { this.loadCategories(); }
  loadCategories() { this.api.getCategories().subscribe(cats => this.categories = cats); }

  onImageSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (!input.files || !input.files[0]) return;
    const reader = new FileReader();
    reader.onload = () => { this.form.image = reader.result as string; };
    reader.readAsDataURL(input.files[0]);
  }

  editCategory(cat: Category) { this.editingId = cat.id; this.form = { ...cat }; this.showForm = true; }

  saveCategory() {
    if (this.editingId) {
      this.api.updateCategory(this.editingId, this.form).subscribe(() => { this.resetForm(); this.loadCategories(); });
    } else {
      this.api.createCategory(this.form).subscribe(() => { this.resetForm(); this.loadCategories(); });
    }
  }

  deleteCategory(id: number) {
    if (confirm('¿Eliminar esta categoría?')) {
      this.api.deleteCategory(id).subscribe(() => this.loadCategories());
    }
  }

  resetForm() {
    this.showForm = false;
    this.editingId = null;
    this.form = { name: '', slug: '', description: '', image: '', isActive: true };
  }
}
