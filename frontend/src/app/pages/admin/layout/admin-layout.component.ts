import { Component, OnInit } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';
import { AuthService } from '../../../services/auth.service';
import { ApiService } from '../../../services/api.service';

interface NavItem { path: string; label: string; icon: string; exact?: boolean; badge?: () => number; }

// Íconos de trazo fino (24x24), dibujados a mano para el panel
const ICONS: Record<string, string> = {
  home: 'M4 11.5 12 5l8 6.5V19a1 1 0 0 1-1 1h-4.5v-5h-5v5H5a1 1 0 0 1-1-1z',
  chart: 'M4 20h16M7 16v-5M12 16V7M17 16v-8',
  bag: 'M6 8h12l1 12H5L6 8Zm3 0V7a3 3 0 0 1 6 0v1',
  tag: 'M3 12V4h8l9 9-8 8-9-9Zm4.5-4.5h.01',
  boxes: 'M4 8l8-4 8 4-8 4-8-4Zm0 0v8l8 4m0-8v8m8-12v8l-8 4',
  grid: 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z',
  settings: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm7.4-3a7.4 7.4 0 0 0-.1-1.2l2-1.6-2-3.4-2.4 1a7.6 7.6 0 0 0-2-1.2L14.5 3h-4l-.4 2.6a7.6 7.6 0 0 0-2 1.2l-2.4-1-2 3.4 2 1.6a7.4 7.4 0 0 0 0 2.4l-2 1.6 2 3.4 2.4-1a7.6 7.6 0 0 0 2 1.2l.4 2.6h4l.4-2.6a7.6 7.6 0 0 0 2-1.2l2.4 1 2-3.4-2-1.6c.1-.4.1-.8.1-1.2Z',
  store: 'M4 9l1.5-5h13L20 9M4 9v11h16V9M4 9h16M9 20v-6h6v6',
  logout: 'M15 4h4v16h-4M10 8l-4 4 4 4M6 12h10',
  percent: 'M19 5 5 19M7.5 9a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Zm9 9a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z',
  mail: 'M4 6h16v12H4zM4 7l8 6 8-6',
};

@Component({
  selector: 'app-admin-layout',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  template: `
    <div class="nova-admin min-h-screen lg:flex bg-[#f4f3f0]">
      <!-- Barra superior (móvil) -->
      <header class="lg:hidden sticky top-0 z-40 flex items-center justify-between h-14 px-4 bg-[#1e1e1e] text-white">
        <button (click)="open = !open" class="p-2 -ml-2" [attr.aria-expanded]="open" aria-label="Abrir menú">
          <svg class="w-6 h-6" fill="none" stroke="currentColor" stroke-width="1.6" viewBox="0 0 24 24"><path d="M4 7h16M4 12h16M4 17h16"/></svg>
        </button>
        <img src="assets/monogram-white.png" alt="Nova FIT" class="h-7">
        <span class="w-8"></span>
      </header>

      @if (open) { <div class="lg:hidden fixed inset-0 z-40 bg-black/40" (click)="open = false"></div> }

      <!-- Menú lateral (la columna oscura ocupa todo el alto aunque la página sea larga) -->
      <div class="lg:w-[248px] lg:shrink-0 lg:bg-[#1e1e1e]">
      <aside class="fixed lg:sticky top-0 z-50 h-screen w-[248px] shrink-0 bg-[#1e1e1e] text-[#d9d6d0] flex flex-col transition-transform duration-200 lg:translate-x-0"
             [class.-translate-x-full]="!open" [class.translate-x-0]="open">
        <a routerLink="/admin" class="flex items-center gap-3 px-6 h-20 border-b border-white/10">
          <img src="assets/monogram-white.png" alt="" class="h-8">
          <span class="leading-tight">
            <span class="block text-white font-semibold tracking-tight">Nova FIT</span>
            <span class="block text-xs text-[#9b978f]">Administración</span>
          </span>
        </a>

        <nav class="flex-1 overflow-y-auto px-3 py-5 space-y-6 text-[14px]">
          @for (group of groups; track group.title) {
            <div>
              <p class="px-3 mb-2 text-[12px] text-[#8a867e]">{{ group.title }}</p>
              @for (item of group.items; track item.path) {
                <a [routerLink]="item.path" routerLinkActive="is-active" [routerLinkActiveOptions]="{ exact: !!item.exact }"
                   (click)="open = false"
                   class="nav-link group flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-white/5 hover:text-white">
                  <svg class="w-[18px] h-[18px] shrink-0" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24">
                    <path [attr.d]="icon(item.icon)"/>
                  </svg>
                  <span class="flex-1">{{ item.label }}</span>
                  @if (item.badge && item.badge() > 0) {
                    <span class="min-w-[22px] h-[20px] px-1.5 rounded-full bg-[#b59677] text-[#1e1e1e] text-[11px] font-semibold flex items-center justify-center tabular-nums">{{ item.badge() }}</span>
                  }
                </a>
              }
            </div>
          }
        </nav>

        <div class="px-3 py-4 border-t border-white/10 text-[14px] space-y-1">
          <a href="/" target="_blank" class="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-white/5 hover:text-white">
            <svg class="w-[18px] h-[18px]" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><path [attr.d]="icon('store')"/></svg>
            Ver la tienda
          </a>
          <button (click)="logout()" class="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-white/5 hover:text-white text-left">
            <svg class="w-[18px] h-[18px]" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><path [attr.d]="icon('logout')"/></svg>
            Cerrar sesión
          </button>
          @if (email) { <p class="px-3 pt-2 text-[12px] text-[#8a867e] truncate">{{ email }}</p> }
        </div>
      </aside>
      </div>

      <main class="flex-1 min-w-0 bg-[#f4f3f0]">
        <div class="max-w-[1280px] mx-auto px-4 sm:px-8 py-6 sm:py-10">
          <router-outlet />
        </div>
      </main>
    </div>
  `,
  styles: [`
    .nav-link.is-active { background: rgba(255,255,255,0.08); color: #fff; box-shadow: inset 3px 0 0 #b59677; }
  `],
})
export class AdminLayoutComponent implements OnInit {
  open = false;
  email = '';
  toShip = 0;

  groups: { title: string; items: NavItem[] }[] = [
    {
      title: 'Negocio',
      items: [
        { path: '/admin', label: 'Inicio', icon: 'home', exact: true },
        { path: '/admin/finanzas', label: 'Finanzas', icon: 'chart' },
        { path: '/admin/pedidos', label: 'Pedidos', icon: 'bag', badge: () => this.toShip },
      ],
    },
    {
      title: 'Catálogo',
      items: [
        { path: '/admin/productos', label: 'Productos', icon: 'tag' },
        { path: '/admin/inventario', label: 'Inventario', icon: 'boxes' },
        { path: '/admin/categorias', label: 'Categorías', icon: 'grid' },
      ],
    },
    {
      title: 'Marketing',
      items: [
        { path: '/admin/descuentos', label: 'Descuentos', icon: 'percent' },
        { path: '/admin/suscriptores', label: 'Suscriptores', icon: 'mail' },
      ],
    },
    { title: 'Ajustes', items: [{ path: '/admin/configuracion', label: 'Configuración', icon: 'settings' }] },
  ];

  constructor(private auth: AuthService, private api: ApiService, private router: Router) {}

  ngOnInit() {
    try { this.email = JSON.parse(localStorage.getItem('nova_user') || '{}').email || ''; } catch {}
    this.refreshBadge();
    // Se actualiza al navegar (por ejemplo, después de marcar un pedido como despachado)
    this.router.events.pipe(filter(e => e instanceof NavigationEnd)).subscribe(() => this.refreshBadge());
  }

  icon(name: string) { return ICONS[name]; }

  private refreshBadge() {
    this.api.getOrders('APPROVED').subscribe({
      next: orders => (this.toShip = orders.filter(o => o.fulfillmentStatus === 'POR_DESPACHAR').length),
      error: () => {},
    });
  }

  logout() {
    this.auth.logout();
    this.router.navigate(['/admin/login']);
  }
}
