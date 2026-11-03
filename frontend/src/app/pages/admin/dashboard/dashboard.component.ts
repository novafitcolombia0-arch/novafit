import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../../services/auth.service';

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [RouterLink],
  template: `
    <div class="max-w-7xl mx-auto px-4 py-8">
      <div class="flex items-center justify-between mb-8">
        <h1 class="font-display text-3xl font-bold text-nova-dark">Admin Panel</h1>
        <button (click)="logout()" class="text-sm text-nova-gray hover:text-red-600 transition">Cerrar sesión</button>
      </div>
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <a routerLink="/admin/categorias" class="bg-white border border-nova-blush rounded-lg p-6 hover:shadow-md transition">
          <h3 class="font-semibold text-lg mb-2 text-nova-dark">Categorías</h3>
          <p class="text-nova-gray text-sm">Gestionar categorías de productos</p>
        </a>
        <a routerLink="/admin/productos" class="bg-white border border-nova-blush rounded-lg p-6 hover:shadow-md transition">
          <h3 class="font-semibold text-lg mb-2 text-nova-dark">Productos</h3>
          <p class="text-nova-gray text-sm">Crear y gestionar productos</p>
        </a>
        <a routerLink="/admin/configuracion" class="bg-white border border-nova-blush rounded-lg p-6 hover:shadow-md transition">
          <h3 class="font-semibold text-lg mb-2 text-nova-dark">Configuración</h3>
          <p class="text-nova-gray text-sm">Hero banner y ajustes del sitio</p>
        </a>
        <a routerLink="/" class="bg-white border border-nova-blush rounded-lg p-6 hover:shadow-md transition">
          <h3 class="font-semibold text-lg mb-2 text-nova-dark">Ver Tienda</h3>
          <p class="text-nova-gray text-sm">Ir a la tienda pública</p>
        </a>
      </div>
    </div>
  `,
})
export class AdminDashboardComponent {
  constructor(private auth: AuthService) {}
  logout() { this.auth.logout(); window.location.href = '/admin/login'; }
}
