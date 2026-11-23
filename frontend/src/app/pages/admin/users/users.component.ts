import { Component, Input, OnInit } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../../services/api.service';
import { AuthService } from '../../../services/auth.service';
import { Role, User } from '../../../models/types';

const ROLE_LABELS: Record<Role, string> = {
  admin: 'Administrador (todo el panel)',
  finanzas: 'Finanzas (solo consulta)',
};

@Component({
  selector: 'app-admin-users',
  imports: [FormsModule, DatePipe],
  template: `
    <div class="w-full max-w-4xl">
      @if (embedded) {
        <h2 class="font-semibold text-lg text-nova-dark mb-2">Usuarios del panel</h2>
      } @else {
        <h1 class="font-display text-3xl font-bold text-nova-dark mb-2">Usuarios</h1>
      }
      <p class="text-sm text-nova-gray mb-6">Quién puede entrar al panel. El usuario de <strong>Finanzas</strong> solo ve la sección de Finanzas (resumen, ventas, gastos, costos y cierres) y puede descargar el Excel, pero no registra ni anula ventas, ni cambia gastos, precios o costos.</p>

      @if (error) { <div class="bg-red-50 text-red-600 p-3 rounded mb-4 text-sm">{{ error }}</div> }
      @if (message) { <div class="bg-green-50 text-green-700 p-3 rounded mb-4 text-sm">{{ message }}</div> }

      <form #uf="ngForm" (ngSubmit)="create()" class="bg-white border border-nova-blush rounded-lg p-5 mb-6">
        <h2 class="font-semibold text-nova-dark mb-1">Crear usuario</h2>
        <p class="text-xs text-nova-gray mb-4">Los campos con <span class="text-red-600">*</span> son obligatorios. La contraseña debe tener al menos 12 caracteres; compártela con la persona por un medio privado.</p>
        <div class="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
          <div>
            <label class="block mb-1">Correo <span class="text-red-600">*</span></label>
            <input [(ngModel)]="form.email" name="email" type="email" required email autocomplete="off" class="inp">
          </div>
          <div>
            <label class="block mb-1">Contraseña <span class="text-red-600">*</span></label>
            <div class="flex gap-1">
              <input [(ngModel)]="form.password" name="password" [type]="showPassword ? 'text' : 'password'" required minlength="12" autocomplete="new-password" class="inp">
              <button type="button" (click)="generate()" class="shrink-0 text-xs underline px-1" title="Generar una contraseña segura">Generar</button>
            </div>
          </div>
          <div>
            <label class="block mb-1">Tipo de usuario <span class="text-red-600">*</span></label>
            <select [(ngModel)]="form.role" name="role" required class="inp">
              <option value="finanzas">{{ roleLabel('finanzas') }}</option>
              <option value="admin">{{ roleLabel('admin') }}</option>
            </select>
          </div>
        </div>
        <div class="flex items-center gap-3 mt-4">
          <button type="submit" [disabled]="uf.invalid || saving" class="bg-nova-dark text-white px-5 py-2 rounded text-sm disabled:opacity-50">
            {{ saving ? 'Creando...' : 'Crear usuario' }}
          </button>
          <label class="text-xs text-nova-gray flex items-center gap-1"><input type="checkbox" [(ngModel)]="showPassword" name="show"> Ver contraseña</label>
        </div>
      </form>

      <div class="bg-white border border-nova-blush rounded-lg overflow-x-auto">
        <table class="w-full text-sm">
          <thead class="bg-nova-cream text-nova-gray">
            <tr>
              <th class="text-left px-4 py-3 font-medium">Correo</th>
              <th class="text-left px-4 py-3 font-medium">Tipo</th>
              <th class="text-left px-4 py-3 font-medium">Creado</th>
              <th class="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            @for (u of users; track u.id) {
              <tr class="border-t border-nova-pink">
                <td class="px-4 py-3 text-nova-dark">{{ u.email }} @if (u.email === myEmail) { <span class="text-xs text-nova-gray">(tú)</span> }</td>
                <td class="px-4 py-3">
                  <select [ngModel]="u.role" (ngModelChange)="changeRole(u, $event)" [disabled]="u.email === myEmail"
                          class="border border-nova-blush rounded px-2 py-1 bg-white">
                    <option value="admin">{{ roleLabel('admin') }}</option>
                    <option value="finanzas">{{ roleLabel('finanzas') }}</option>
                  </select>
                </td>
                <td class="px-4 py-3 text-nova-gray whitespace-nowrap">{{ u.createdAt | date:'dd/MM/yy' }}</td>
                <td class="px-4 py-3 text-right whitespace-nowrap">
                  <button (click)="resetPassword(u)" class="text-xs underline text-nova-dark mr-3">Nueva contraseña</button>
                  @if (u.email !== myEmail) {
                    <button (click)="remove(u)" class="text-xs text-red-600 hover:underline">Eliminar</button>
                  }
                </td>
              </tr>
            } @empty {
              <tr><td colspan="4" class="px-4 py-10 text-center text-nova-gray">Cargando...</td></tr>
            }
          </tbody>
        </table>
      </div>
    </div>
  `,
  styles: [`.inp { @apply w-full border border-nova-blush rounded px-3 py-2 bg-white focus:outline-none focus:border-nova-rose; }`],
})
export class AdminUsersComponent implements OnInit {
  /** true cuando se muestra dentro de Configuración (título más pequeño) */
  @Input() embedded = false;
  users: User[] = [];
  form = { email: '', password: '', role: 'finanzas' as Role };
  saving = false;
  showPassword = false;
  error = '';
  message = '';
  myEmail = '';

  constructor(private api: ApiService, auth: AuthService) {
    this.myEmail = auth.currentEmail();
  }

  ngOnInit() { this.load(); }

  load() {
    this.api.getUsers().subscribe({ next: u => (this.users = u), error: () => (this.error = 'No se pudieron cargar los usuarios') });
  }

  roleLabel(role: Role) { return ROLE_LABELS[role] || role; }

  /** Contraseña aleatoria de 16 caracteres, sin letras que se confundan */
  generate() {
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
    const bytes = crypto.getRandomValues(new Uint8Array(16));
    this.form.password = Array.from(bytes, b => alphabet[b % alphabet.length]).join('');
    this.showPassword = true;
  }

  create() {
    this.saving = true;
    this.error = '';
    this.message = '';
    this.api.createUser({ ...this.form, email: this.form.email.trim() }).subscribe({
      next: u => {
        this.saving = false;
        this.message = `Usuario ${u.email} creado. Compártele su contraseña por un medio privado.`;
        this.form = { email: '', password: '', role: 'finanzas' };
        this.showPassword = false;
        this.load();
      },
      error: err => { this.saving = false; this.error = err?.error?.message || 'No se pudo crear el usuario'; },
    });
  }

  changeRole(u: User, role: Role) {
    if (!confirm(`¿Cambiar a ${u.email} a "${this.roleLabel(role)}"? Se cerrará su sesión.`)) { this.load(); return; }
    this.api.updateUser(u.id, { role }).subscribe({
      next: () => { this.message = 'Tipo de usuario actualizado'; this.load(); },
      error: err => { this.error = err?.error?.message || 'No se pudo cambiar'; this.load(); },
    });
  }

  resetPassword(u: User) {
    const password = prompt(`Nueva contraseña para ${u.email} (mínimo 12 caracteres). Se cerrarán sus sesiones abiertas:`);
    if (!password) return;
    this.api.updateUser(u.id, { password }).subscribe({
      next: () => (this.message = `Contraseña de ${u.email} actualizada`),
      error: err => (this.error = err?.error?.message || 'No se pudo cambiar la contraseña'),
    });
  }

  remove(u: User) {
    if (!confirm(`¿Eliminar el usuario ${u.email}? Ya no podrá entrar al panel.`)) return;
    this.api.deleteUser(u.id).subscribe({
      next: () => { this.message = 'Usuario eliminado'; this.load(); },
      error: err => (this.error = err?.error?.message || 'No se pudo eliminar'),
    });
  }
}
