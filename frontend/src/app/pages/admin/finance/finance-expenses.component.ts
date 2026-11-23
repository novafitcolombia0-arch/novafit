import { Component, Input, OnChanges, inject } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../../services/api.service';
import { AuthService } from '../../../services/auth.service';
import { Expense, FinanceRange } from '../../../models/types';
import { EXPENSE_LABELS, label, money } from './finance-format';

const today = () => new Date(Date.now() - 5 * 3600_000).toISOString().slice(0, 10);

@Component({
    selector: 'app-finance-expenses',
    imports: [FormsModule, DatePipe],
    template: `
    @if (error) { <div class="bg-red-50 text-red-600 p-3 rounded mb-4 text-sm">{{ error }}</div> }

    @if (canEdit) {
    <div class="bg-white border border-nova-blush rounded-lg p-5 mb-6">
      <h3 class="font-semibold text-nova-dark mb-1">{{ editingId ? 'Editar gasto' : 'Registrar gasto' }}</h3>
      <p class="text-xs text-nova-gray mb-4">Todo lo que sale de la caja y no es el costo de las prendas: pauta en Meta, envíos que pagas tú, bolsas y empaques, plataformas, etc.</p>
      <div class="grid grid-cols-2 md:grid-cols-6 gap-3 items-end text-sm">
        <div><label class="block mb-1">Fecha</label><input type="date" [(ngModel)]="form.date" class="inp"></div>
        <div class="md:col-span-2"><label class="block mb-1">Categoría</label>
          <select [(ngModel)]="form.category" class="inp">
            @for (c of categories; track c) { <option [value]="c">{{ categoryLabel(c) }}</option> }
          </select>
        </div>
        <div class="col-span-2 md:col-span-2"><label class="block mb-1">Descripción</label><input [(ngModel)]="form.description" placeholder="Ej: Campaña Creamy x Nf" class="inp"></div>
        <div><label class="block mb-1">Valor</label><input type="number" min="0" [(ngModel)]="form.amount" class="inp"></div>
      </div>
      <div class="flex items-center gap-3 mt-4">
        <button (click)="save()" [disabled]="saving" class="bg-nova-dark text-white px-5 py-2 rounded text-sm disabled:opacity-50">
          {{ saving ? 'Guardando...' : (editingId ? 'Guardar cambios' : 'Agregar gasto') }}
        </button>
        @if (editingId) { <button (click)="reset()" class="text-sm text-nova-gray">Cancelar</button> }
        @if (formError) { <span class="text-red-600 text-sm">{{ formError }}</span> }
      </div>
    </div>
    }

    <div class="flex flex-wrap gap-2 mb-4 text-sm">
      @for (t of totalsByCategory(); track t.category) {
        <span class="bg-nova-pink rounded px-3 py-1">{{ categoryLabel(t.category) }}: <strong>{{ money(t.total) }}</strong></span>
      }
      <span class="ml-auto font-semibold text-nova-dark">Total gastos: {{ money(total()) }}</span>
    </div>

    <div class="bg-white border border-nova-blush rounded-lg overflow-x-auto">
      <table class="w-full text-sm">
        <thead class="bg-nova-cream text-nova-gray">
          <tr>
            <th class="text-left px-3 py-2 font-medium">Fecha</th>
            <th class="text-left px-3 py-2 font-medium">Categoría</th>
            <th class="text-left px-3 py-2 font-medium">Descripción</th>
            <th class="text-right px-3 py-2 font-medium">Valor</th>
            <th class="px-3 py-2"></th>
          </tr>
        </thead>
        <tbody>
          @for (e of expenses; track e.id) {
            <tr class="border-t border-nova-pink">
              <td class="px-3 py-2 whitespace-nowrap text-nova-gray">{{ e.date + 'T12:00:00' | date:'dd/MM/yyyy' }}</td>
              <td class="px-3 py-2">{{ categoryLabel(e.category) }}</td>
              <td class="px-3 py-2">{{ e.description }}</td>
              <td class="px-3 py-2 text-right">{{ money(e.amount) }}</td>
              <td class="px-3 py-2 text-right whitespace-nowrap">
                @if (canEdit) {
                  <button (click)="edit(e)" class="text-xs text-nova-dark hover:underline mr-3">Editar</button>
                  <button (click)="remove(e)" class="text-xs text-red-600 hover:underline">Eliminar</button>
                }
              </td>
            </tr>
          } @empty {
            <tr><td colspan="5" class="px-3 py-12 text-center text-nova-gray">No hay gastos en estas fechas</td></tr>
          }
        </tbody>
      </table>
    </div>
  `,
    styles: [`.inp { @apply w-full border border-nova-blush rounded px-2 py-1.5 bg-white focus:outline-none focus:border-nova-rose; }`]
})
export class FinanceExpensesComponent implements OnChanges {
  @Input({ required: true }) range!: FinanceRange;

  expenses: Expense[] = [];
  categories = Object.keys(EXPENSE_LABELS);
  form = this.emptyForm();
  editingId: number | null = null;
  saving = false;
  error = '';
  formError = '';
  money = money;

  /** El usuario de finanzas solo consulta */
  readonly canEdit = inject(AuthService).isAdmin();

  constructor(private api: ApiService) {}

  ngOnChanges() { this.load(); }

  load() {
    this.api.getExpenses(this.range).subscribe({
      next: e => (this.expenses = e),
      error: () => (this.error = 'No se pudieron cargar los gastos'),
    });
  }

  emptyForm() { return { date: today(), category: 'PUBLICIDAD', description: '', amount: null as number | null }; }

  categoryLabel(c: string) { return label(EXPENSE_LABELS, c); }
  total() { return this.expenses.reduce((t, e) => t + e.amount, 0); }
  totalsByCategory() {
    const map = new Map<string, number>();
    this.expenses.forEach(e => map.set(e.category, (map.get(e.category) || 0) + e.amount));
    return [...map.entries()].map(([category, total]) => ({ category, total })).sort((a, b) => b.total - a.total);
  }

  edit(e: Expense) {
    this.editingId = e.id;
    this.form = { date: e.date, category: e.category, description: e.description, amount: e.amount };
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  reset() { this.editingId = null; this.form = this.emptyForm(); this.formError = ''; }

  save() {
    this.formError = '';
    if (!this.form.description.trim() || !(Number(this.form.amount) > 0)) {
      this.formError = 'Escribe la descripción y un valor mayor a 0';
      return;
    }
    this.saving = true;
    const data = { ...this.form, amount: Number(this.form.amount) };
    const req = this.editingId ? this.api.updateExpense(this.editingId, data) : this.api.createExpense(data);
    req.subscribe({
      next: () => { this.saving = false; this.reset(); this.load(); },
      error: err => { this.saving = false; this.formError = err?.error?.message || 'No se pudo guardar'; },
    });
  }

  remove(e: Expense) {
    if (!confirm(`¿Eliminar el gasto "${e.description}" por ${money(e.amount)}?`)) return;
    this.api.deleteExpense(e.id).subscribe({ next: () => this.load(), error: () => (this.error = 'No se pudo eliminar') });
  }
}
