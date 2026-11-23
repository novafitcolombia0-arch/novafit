import { Injectable, computed, signal } from '@angular/core';
import { CartItem, Product } from '../models/types';

const STORAGE_KEY = 'nova_cart';
export const MAX_QTY_PER_LINE = 10;

/** Una línea del carrito es un producto en un color y una talla */
type LineKey = Pick<CartItem, 'productId' | 'size'> & { color?: string };
const sameLine = (a: LineKey, b: LineKey) =>
  a.productId === b.productId && a.size === b.size && (a.color || '') === (b.color || '');

@Injectable({ providedIn: 'root' })
export class CartService {
  readonly items = signal<CartItem[]>(this.load());
  readonly count = computed(() => this.items().reduce((n, i) => n + i.quantity, 0));
  readonly subtotal = computed(() => this.items().reduce((sum, i) => sum + i.price * i.quantity, 0));

  add(product: Product, color: string, size: string, image: string | null, quantity = 1) {
    const stock = product.sizes.find(s => s.size === size && (s.color || '') === color)?.stock ?? 0;
    const limit = Math.min(stock, MAX_QTY_PER_LINE);
    const items = [...this.items()];
    const line: LineKey = { productId: product.id, color, size };
    const existing = items.find(i => sameLine(i, line));
    if (existing) {
      existing.quantity = Math.min(existing.quantity + quantity, limit);
      existing.maxQuantity = limit;
      existing.price = Number(product.price);
      existing.image = image;
    } else {
      items.push({
        productId: product.id,
        slug: product.slug,
        name: product.name,
        price: Number(product.price),
        image,
        color,
        size,
        quantity: Math.min(quantity, limit),
        maxQuantity: limit,
      });
    }
    this.save(items);
  }

  setQuantity(line: LineKey, quantity: number) {
    this.save(
      this.items().map(i =>
        sameLine(i, line)
          ? { ...i, quantity: Math.max(1, Math.min(quantity, i.maxQuantity || MAX_QTY_PER_LINE)) }
          : i
      )
    );
  }

  remove(line: LineKey) {
    this.save(this.items().filter(i => !sameLine(i, line)));
  }

  clear() {
    this.save([]);
  }

  /** "Rojo · M", "M" o "Talla única" para mostrar en el carrito y el checkout */
  static variantLabel(item: { color?: string; size: string }) {
    const size = item.size === 'Única' ? 'Talla única' : `Talla ${item.size}`;
    return item.color ? `${item.color} · ${size}` : size;
  }

  private save(items: CartItem[]) {
    this.items.set(items);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(items)); } catch {}
  }

  private load(): CartItem[] {
    try {
      const data = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
      return Array.isArray(data) ? data.map(i => ({ ...i, color: i.color || '' })) : [];
    } catch {
      return [];
    }
  }
}
