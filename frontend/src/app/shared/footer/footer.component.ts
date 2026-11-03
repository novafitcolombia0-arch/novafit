import { Component } from '@angular/core';

@Component({
  selector: 'app-footer',
  standalone: true,
  template: `
    <footer class="bg-nova-dark text-white mt-16">
      <div class="max-w-7xl mx-auto px-4 py-12">
        <div class="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div>
            <h3 class="font-display text-2xl font-bold tracking-wider mb-4">NOVA</h3>
            <p class="text-nova-blush text-sm">Moda femenina con estilo y elegancia.</p>
          </div>
          <div>
            <h4 class="text-sm uppercase tracking-widest mb-4">Enlaces</h4>
            <ul class="space-y-2 text-nova-blush text-sm">
              <li><a href="/catalogo" class="hover:text-nova-sand transition">Tienda</a></li>
              <li><a href="#" class="hover:text-nova-sand transition">Sobre Nosotros</a></li>
              <li><a href="#" class="hover:text-nova-sand transition">Contacto</a></li>
            </ul>
          </div>
          <div>
            <h4 class="text-sm uppercase tracking-widest mb-4">Contacto</h4>
            <p class="text-nova-blush text-sm">WhatsApp: +57 300 123 4567</p>
            <p class="text-nova-blush text-sm">Email: info&#64;nova.com</p>
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
