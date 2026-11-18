import { Component, OnInit } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../../services/api.service';
import { Subscriber } from '../../../models/types';

@Component({
    selector: 'app-admin-subscribers',
    imports: [DatePipe, FormsModule],
    template: `
    <div class="w-full">
      <div class="flex flex-wrap items-end justify-between gap-4 mb-6">
        <h1 class="font-display text-3xl font-bold text-nova-dark">Suscriptores</h1>
        <p class="text-sm text-nova-gray">{{ filtered.length }} de {{ subscribers.length }} suscriptores</p>
      </div>

      @if (error) { <div class="bg-red-50 text-red-600 p-3 rounded mb-4 text-sm">{{ error }}</div> }

      <div class="flex flex-wrap gap-3 mb-4">
        <input [(ngModel)]="search" (ngModelChange)="page = 1" placeholder="Buscar correo, nombre o código"
               class="flex-1 min-w-[16rem] border border-nova-blush rounded px-3 py-2 text-sm bg-white">
        <button (click)="exportCsv()" [disabled]="filtered.length === 0"
                class="text-sm px-4 py-2 rounded border border-nova-dark text-nova-dark hover:bg-nova-dark hover:text-white transition disabled:opacity-40">
          Descargar CSV
        </button>
      </div>

      <div class="bg-white border border-nova-blush rounded-lg overflow-x-auto">
        <table class="w-full text-sm">
          <thead class="bg-nova-pink text-nova-dark text-left">
            <tr>
              <th class="px-3 py-2.5 font-semibold">Correo</th>
              <th class="px-3 py-2.5 font-semibold">Nombre</th>
              <th class="px-3 py-2.5 font-semibold">Código entregado</th>
              <th class="px-3 py-2.5 font-semibold">Fecha</th>
              <th class="px-3 py-2.5"></th>
            </tr>
          </thead>
          <tbody>
            @if (loading) {
              <tr><td colspan="5" class="px-3 py-10 text-center text-nova-gray">Cargando…</td></tr>
            } @else if (filtered.length === 0) {
              <tr><td colspan="5" class="px-3 py-10 text-center text-nova-gray">
                {{ subscribers.length ? 'Nadie coincide con la búsqueda.' : 'Todavía no hay suscriptores.' }}
              </td></tr>
            }
            @for (s of paged; track s.id) {
              <tr class="border-t border-nova-blush">
                <td class="px-3 py-2.5 text-nova-dark">{{ s.email }}</td>
                <td class="px-3 py-2.5 text-nova-gray">{{ s.name || '—' }}</td>
                <td class="px-3 py-2.5 font-mono text-nova-gray">{{ s.discountCode || '—' }}</td>
                <td class="px-3 py-2.5 text-nova-gray whitespace-nowrap">{{ s.createdAt | date:'dd/MM/yyyy HH:mm' }}</td>
                <td class="px-3 py-2.5 text-right"><button (click)="remove(s)" class="text-xs underline text-red-600">Eliminar</button></td>
              </tr>
            }
          </tbody>
        </table>
      </div>

      @if (filtered.length > pageSize) {
        <nav class="flex items-center justify-between gap-3 mt-4 text-sm" aria-label="Paginación de suscriptores">
          <p class="text-nova-gray">Mostrando {{ (currentPage - 1) * pageSize + 1 }}–{{ Math.min(currentPage * pageSize, filtered.length) }} de {{ filtered.length }}</p>
          <div class="flex gap-1">
            <button (click)="page = currentPage - 1" [disabled]="currentPage === 1"
                    class="px-3 py-1.5 rounded border border-nova-blush bg-white hover:bg-nova-pink disabled:opacity-40">‹ Anterior</button>
            <span class="px-3 py-1.5 text-nova-gray">{{ currentPage }} / {{ totalPages }}</span>
            <button (click)="page = currentPage + 1" [disabled]="currentPage === totalPages"
                    class="px-3 py-1.5 rounded border border-nova-blush bg-white hover:bg-nova-pink disabled:opacity-40">Siguiente ›</button>
          </div>
        </nav>
      }
    </div>
  `
})
export class AdminSubscribersComponent implements OnInit {
  subscribers: Subscriber[] = [];
  search = '';
  page = 1;
  readonly pageSize = 10;
  loading = false;
  error = '';
  Math = Math;

  constructor(private api: ApiService) {}

  ngOnInit() { this.load(); }

  load() {
    this.loading = true;
    this.api.getSubscribers().subscribe({
      next: s => { this.subscribers = s; this.loading = false; },
      error: () => { this.error = 'No se pudieron cargar los suscriptores'; this.loading = false; },
    });
  }

  get filtered(): Subscriber[] {
    const q = this.search.trim().toLowerCase();
    return q ? this.subscribers.filter(s => [s.email, s.name, s.discountCode].filter(Boolean).join(' ').toLowerCase().includes(q)) : this.subscribers;
  }

  get totalPages() { return Math.max(1, Math.ceil(this.filtered.length / this.pageSize)); }
  get currentPage() { return Math.min(Math.max(1, this.page), this.totalPages); }
  get paged() { const start = (this.currentPage - 1) * this.pageSize; return this.filtered.slice(start, start + this.pageSize); }

  remove(s: Subscriber) {
    if (!confirm(`¿Eliminar a ${s.email} de los suscriptores?`)) return;
    this.api.deleteSubscriber(s.id).subscribe({ next: () => this.load(), error: () => (this.error = 'No se pudo eliminar') });
  }

  /** CSV con ; (Excel en español lo abre en columnas) y BOM para las tildes */
  exportCsv() {
    const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const rows = [['Correo', 'Nombre', 'Código entregado', 'Fecha'],
      ...this.filtered.map(s => [s.email, s.name, s.discountCode, new Date(s.createdAt).toLocaleString('es-CO')])];
    const csv = '﻿' + rows.map(r => r.map(esc).join(';')).join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const a = Object.assign(document.createElement('a'), { href: url, download: `suscriptores-novafit-${new Date().toISOString().slice(0, 10)}.csv` });
    a.click();
    URL.revokeObjectURL(url);
  }
}
