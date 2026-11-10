import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-footer',
  standalone: true,
  imports: [RouterLink],
  template: `
    <footer class="bg-nova-dark text-white mt-16">
      <div class="max-w-7xl mx-auto px-4 py-12">
        <div class="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div>
            <h3 class="font-display text-2xl font-bold tracking-wider mb-4">NOVA</h3>
            <p class="text-nova-blush text-sm">Muestra tu mejor versión.</p>
          </div>
          <div>
            <h4 class="text-sm uppercase tracking-widest mb-4">Enlaces</h4>
            <ul class="space-y-2 text-nova-blush text-sm">
              <li><a routerLink="/catalogo" class="hover:text-nova-sand transition">Tienda</a></li>
              <li><a routerLink="/conocenos" class="hover:text-nova-sand transition">Conócenos</a></li>
              <li><a routerLink="/garantias-y-cambios" class="hover:text-nova-sand transition">Garantías y cambios</a></li>
            </ul>
          </div>
          <div>
            <h4 class="text-sm uppercase tracking-widest mb-4">Contacto</h4>
            <p class="text-nova-blush text-sm">WhatsApp: <a href="https://wa.me/573187016549" target="_blank" rel="noopener" class="hover:text-nova-sand transition">+57 318 701 6549</a></p>
            <p class="text-nova-blush text-sm">Correo: <a href="mailto:novafitcolombia0@gmail.com" class="hover:text-nova-sand transition">novafitcolombia0&#64;gmail.com</a></p>
          </div>
        </div>
        <div class="border-t border-nova-rose mt-8 pt-8 text-center text-nova-blush text-xs">
          &copy; 2026 NOVA. Todos los derechos reservados.
        </div>
      </div>
    </footer>
  `,
})
export class FooterComponent {}
