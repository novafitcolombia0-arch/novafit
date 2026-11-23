import { Component, EventEmitter, Input, Output } from '@angular/core';
import { Router } from '@angular/router';
import { Product, ProductImage } from '../../models/types';

/**
 * Circulitos de color debajo de cada prenda (catálogo e inicio). Solo aparecen si la prenda
 * tiene más de un color. Al pasar el mouse se avisa para mostrar la foto de ese color y al
 * tocar uno se abre la prenda con ese color elegido.
 */
@Component({
  selector: 'app-color-dots',
  template: `
    @if ((product.colors?.length || 0) > 1) {
      <div class="flex flex-wrap items-center gap-1.5 mt-2" (mouseleave)="preview.emit('')">
        @for (c of product.colors; track c.name) {
          <button type="button" [title]="c.name" [attr.aria-label]="'Ver en ' + c.name"
                  (mouseenter)="preview.emit(c.name)" (click)="open($event, c.name)"
                  [class.opacity-40]="!hasStock(c.name)"
                  class="w-4 h-4 rounded-full border border-nova-blush hover:ring-1 hover:ring-nova-dark ring-offset-1 transition"
                  [style.background]="c.hex"></button>
        }
        <span class="text-[11px] text-nova-gray ml-1">{{ product.colors!.length }} colores</span>
      </div>
    }
  `,
})
export class ColorDotsComponent {
  @Input({ required: true }) product!: Product;
  @Output() preview = new EventEmitter<string>();

  constructor(private router: Router) {}

  hasStock(color: string) {
    return this.product.sizes?.some(s => s.color === color && s.stock > 0);
  }

  open(event: Event, color: string) {
    // Los circulitos están dentro del enlace de la tarjeta: se abre la prenda con el color elegido
    event.preventDefault();
    event.stopPropagation();
    this.router.navigate(['/producto', this.product.slug], { queryParams: { color } });
  }
}

/** Foto de la tarjeta: la del color que se está señalando, o la principal */
export function cardImage(product: Product, color = ''): string | null {
  const images: ProductImage[] = product.images || [];
  const pick = (color && (images.find(i => i.color === color && i.isMain) || images.find(i => i.color === color)))
    || images.find(i => i.isMain) || images[0];
  return pick?.imageData || null;
}
