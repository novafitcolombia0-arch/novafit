import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

@Component({
  selector: 'app-navbar',
  standalone: true,
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
          <button (click)="toggleMenu()" class="md:hidden text-white">
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"/>
            </svg>
          </button>
        </div>
      </div>
      @if (menuOpen) {
        <div class="md:hidden bg-nova-black px-4 pb-4">
          <a routerLink="/catalogo" class="block py-2 text-sm uppercase tracking-widest">Tienda</a>
          <a routerLink="/conocenos" class="block py-2 text-sm uppercase tracking-widest">Conócenos</a>
        </div>
      }
    </nav>
  `,
})
export class NavbarComponent {
  menuOpen = false;
  toggleMenu() { this.menuOpen = !this.menuOpen; }
}
