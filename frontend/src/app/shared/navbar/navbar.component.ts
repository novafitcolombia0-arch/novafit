import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { AsyncPipe } from '@angular/common';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, AsyncPipe],
  template: `
    <nav class="bg-nova-dark text-white sticky top-0 z-50">
      <div class="max-w-7xl mx-auto px-4">
        <div class="flex items-center justify-between h-16">
          <a routerLink="/" class="font-display text-2xl font-bold tracking-wider">NOVA</a>
          <div class="hidden md:flex items-center space-x-8">
            <a routerLink="/catalogo" routerLinkActive="text-nova-sand"
               [routerLinkActiveOptions]="{exact: true}"
               class="text-sm uppercase tracking-widest hover:text-nova-sand transition">Tienda</a>
            @if (auth.user$ | async) {
              <a routerLink="/admin" class="text-sm uppercase tracking-widest hover:text-nova-sand transition">Admin</a>
            } @else {
              <a routerLink="/admin/login" class="text-sm uppercase tracking-widest hover:text-nova-sand transition">Admin</a>
            }
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
          <a routerLink="/admin" class="block py-2 text-sm uppercase tracking-widest">Admin</a>
        </div>
      }
    </nav>
  `,
})
export class NavbarComponent {
  menuOpen = false;
  constructor(public auth: AuthService) {}
  toggleMenu() { this.menuOpen = !this.menuOpen; }
}
