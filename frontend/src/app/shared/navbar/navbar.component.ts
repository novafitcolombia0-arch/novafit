import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { CartService } from '../../services/cart.service';

@Component({
    selector: 'app-navbar',
    imports: [RouterLink, RouterLinkActive],
    template: `
    <nav class="bg-nova-dark text-white sticky top-0 z-50">
      <div class="max-w-7xl mx-auto px-4">
        <div class="flex items-center justify-between h-16">
          <a routerLink="/" class="flex items-center">
            <img src="assets/logo-white.png" alt="Nova FIT" class="h-11 w-auto">
          </a>
          <div class="hidden md:flex items-center space-x-8">
            <a routerLink="/catalogo" routerLinkActive="text-nova-sand"
               [routerLinkActiveOptions]="{exact: true}"
               class="text-sm uppercase tracking-widest hover:text-nova-sand transition">Tienda</a>
            <a routerLink="/conocenos" routerLinkActive="text-nova-sand"
               class="text-sm uppercase tracking-widest hover:text-nova-sand transition">Conócenos</a>
          </div>
          <div class="flex items-center gap-5">
            <a routerLink="/carrito" class="relative hover:text-nova-sand transition" aria-label="Bolsa de compras">
              <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M6 7h12l1 13H5L6 7zm3 0V6a3 3 0 016 0v1"/>
              </svg>
              @if (cart.count() > 0) {
                <span class="absolute -top-1.5 -right-2 bg-nova-sand text-white text-[10px] font-semibold rounded-full min-w-[18px] h-[18px] px-1 flex items-center justify-center">{{ cart.count() }}</span>
              }
            </a>
            <button (click)="toggleMenu()" class="md:hidden text-white">
              <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"/>
              </svg>
            </button>
          </div>
        </div>
      </div>
      @if (menuOpen) {
        <div class="md:hidden bg-nova-black px-4 pb-4">
          <a routerLink="/catalogo" class="block py-2 text-sm uppercase tracking-widest">Tienda</a>
          <a routerLink="/conocenos" class="block py-2 text-sm uppercase tracking-widest">Conócenos</a>
        </div>
      }
    </nav>
  `
})
export class NavbarComponent {
  menuOpen = false;
  constructor(public cart: CartService) {}
  toggleMenu() { this.menuOpen = !this.menuOpen; }
}
