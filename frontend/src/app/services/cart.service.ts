import { Injectable, computed, signal } from '@angular/core';
import { CartItem, Product } from '../models/types';

const STORAGE_KEY = 'nova_cart';
export const MAX_QTY_PER_LINE = 10;

@Injectable({ providedIn: 'root' })
export class CartService {
  readonly items = signal<CartItem[]>(this.load());
  readonly count = computed(() => this.items().reduce((n, i) => n + i.quantity, 0));
  readonly subtotal = computed(() => this.items().reduce((sum, i) => sum + i.price * i.quantity, 0));

  add(product: Product, size: string, image: string | null, quantity = 1) {
    const stock = product.sizes.find(s => s.size === size)?.stock ?? 0;
    const limit = Math.min(stock, MAX_QTY_PER_LINE);
    const items = [...this.items()];
    const existing = items.find(i => i.productId === product.id && i.size === size);
    if (existing) {
      existing.quantity = Math.min(existing.quantity + quantity, limit);
      existing.maxQuantity = limit;
      existing.price = Number(product.price);
    } else {
      items.push({
        productId: product.id,
        slug: product.slug,
        name: product.name,
        price: Number(product.price),
        image,
        size,
        quantity: Math.min(quantity, limit),
        maxQuantity: limit,
      });
    }
    this.save(items);
  }

  setQuantity(productId: number, size: string, quantity: number) {
    this.save(
      this.items().map(i =>
        i.productId === productId && i.size === size
          ? { ...i, quantity: Math.max(1, Math.min(quantity, i.maxQuantity || MAX_QTY_PER_LINE)) }
          : i
      )
    );
  }

  remove(productId: number, size: string) {
    this.save(this.items().filter(i => !(i.productId === productId && i.size === size)));
  }

  clear() {
    this.save([]);
  }

  private save(items: CartItem[]) {
    this.items.set(items);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(items)); } catch {}
  }

  private load(): CartItem[] {
    try {
      const data = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
      return Array.isArray(data) ? data : [];
    } catch {
      return [];
    }
  }
}
