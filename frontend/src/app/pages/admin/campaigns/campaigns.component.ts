import { Component, OnDestroy, OnInit } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../../services/api.service';
import { CampaignDraft, CampaignsInfo } from '../../../models/types';

const emptyDraft = (): CampaignDraft => ({ subject: '', title: '', message: '', discountCode: '', buttonText: 'Shop Now', buttonUrl: '' });

@Component({
  selector: 'app-admin-campaigns',
  imports: [DatePipe, FormsModule],
  template: `
    <div class="w-full">
      <h1 class="font-display text-3xl font-bold text-nova-dark mb-6">Promociones</h1>

      @if (info && !info.configured) {
        <div class="bg-yellow-50 text-yellow-800 p-4 rounded mb-6 text-sm">
          El envío de correos todavía no está configurado. Falta la llave de Brevo en el servidor
          (BREVO_API_KEY y EMAIL_FROM). Puedes preparar la promoción, pero no se enviará.
        </div>
      }
      @if (message) { <div class="bg-green-50 text-green-700 p-3 rounded mb-4 text-sm">{{ message }}</div> }
      @if (error) { <div class="bg-red-50 text-red-600 p-3 rounded mb-4 text-sm">{{ error }}</div> }

      <div class="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-8">
        <!-- Redactar -->
        <section class="bg-white border border-nova-blush rounded-lg p-5">
          <h2 class="font-semibold text-nova-dark mb-4">Nueva promoción</h2>
          <form class="space-y-3 text-sm" (ngSubmit)="send()">
            <label class="block">
              <span class="block text-nova-gray mb-1">Asunto del correo *</span>
              <input [(ngModel)]="draft.subject" name="subject" maxlength="150" required placeholder="Ej.: 20% en toda la tienda solo este fin de semana" class="input">
            </label>
            <label class="block">
              <span class="block text-nova-gray mb-1">Título *</span>
              <input [(ngModel)]="draft.title" name="title" maxlength="150" required placeholder="Ej.: ¡Black Friday Nova FIT!" class="input">
            </label>
            <label class="block">
              <span class="block text-nova-gray mb-1">Mensaje *</span>
              <textarea [(ngModel)]="draft.message" name="message" rows="6" maxlength="5000" required
                        placeholder="Escribe el texto. Deja una línea en blanco para separar párrafos." class="input"></textarea>
            </label>
            <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <label class="block">
                <span class="block text-nova-gray mb-1">Código (opcional)</span>
                <input [(ngModel)]="draft.discountCode" name="discountCode" placeholder="NOVA-XXXX" class="input uppercase">
              </label>
              <label class="block">
                <span class="block text-nova-gray mb-1">Texto del botón</span>
                <input [(ngModel)]="draft.buttonText" name="buttonText" maxlength="40" class="input">
              </label>
              <label class="block">
                <span class="block text-nova-gray mb-1">Enlace del botón</span>
                <input [(ngModel)]="draft.buttonUrl" name="buttonUrl" placeholder="Vacío = la tienda" class="input">
              </label>
            </div>

            <div class="flex flex-wrap items-end gap-3 pt-2">
              <label class="block flex-1 min-w-[12rem]">
                <span class="block text-nova-gray mb-1">Enviar prueba a</span>
                <input [(ngModel)]="testTo" name="testTo" type="email" placeholder="Vacío = tu correo de admin" class="input">
              </label>
              <button type="button" (click)="sendTest()" [disabled]="busy || !valid"
                      class="px-4 py-2 rounded border border-nova-dark text-nova-dark hover:bg-nova-dark hover:text-white transition disabled:opacity-40">
                Enviar prueba
              </button>
            </div>
            <button type="submit" [disabled]="busy || !valid || !info?.configured || !info?.activeSubscribers || sending"
                    class="w-full bg-nova-dark text-white px-4 py-3 rounded uppercase tracking-wider hover:bg-nova-black transition disabled:opacity-40">
              {{ sending ? 'Enviando promoción…' : 'Enviar a ' + (info?.activeSubscribers ?? 0) + ' suscriptores' }}
            </button>
            <p class="text-xs text-nova-gray">Solo se envía a suscriptores activos. Cada correo incluye un enlace para darse de baja.</p>
          </form>
        </section>

        <!-- Vista previa -->
        <section class="bg-[#f6f3ef] border border-nova-blush rounded-lg p-5">
          <h2 class="font-semibold text-nova-dark mb-4">Vista previa</h2>
          <div class="bg-white rounded-lg p-6 max-w-md mx-auto text-sm text-nova-dark">
            <p class="text-xs text-nova-gray mb-3">Asunto: <strong class="text-nova-dark">{{ draft.subject || '…' }}</strong></p>
            <img src="assets/logo-black.png" alt="Nova FIT" class="h-10 mx-auto mb-4">
            <h3 class="text-xl font-bold text-center mb-4">{{ draft.title || 'Título de la promoción' }}</h3>
            @for (p of paragraphs; track $index) { <p class="mb-3 whitespace-pre-line leading-relaxed">{{ p }}</p> }
            @if (draft.discountCode) {
              <p class="text-center my-4"><span class="inline-block font-mono text-lg tracking-widest border-2 border-dashed border-nova-rose rounded px-4 py-2">{{ draft.discountCode.toUpperCase() }}</span></p>
            }
            <p class="text-center mt-5"><span class="inline-block bg-nova-dark text-white px-6 py-3 rounded text-xs uppercase tracking-widest">{{ draft.buttonText || 'Shop Now' }}</span></p>
            <p class="text-[11px] text-nova-gray text-center mt-6">Nova FIT · Darme de baja de los correos</p>
          </div>
        </section>
      </div>

      <!-- Historial -->
      <h2 class="font-semibold text-nova-dark mb-3">Enviadas</h2>
      <div class="bg-white border border-nova-blush rounded-lg overflow-x-auto">
        <table class="w-full text-sm">
          <thead class="bg-nova-pink text-nova-dark text-left">
            <tr>
              <th class="px-3 py-2.5 font-semibold">Fecha</th>
              <th class="px-3 py-2.5 font-semibold">Asunto</th>
              <th class="px-3 py-2.5 font-semibold text-center">Destinatarios</th>
              <th class="px-3 py-2.5 font-semibold text-center">Enviados</th>
              <th class="px-3 py-2.5 font-semibold text-center">Fallidos</th>
              <th class="px-3 py-2.5 font-semibold">Estado</th>
            </tr>
          </thead>
          <tbody>
            @if (!info?.campaigns?.length) {
              <tr><td colspan="6" class="px-3 py-10 text-center text-nova-gray">Todavía no has enviado promociones.</td></tr>
            }
            @for (c of info?.campaigns || []; track c.id) {
              <tr class="border-t border-nova-blush">
                <td class="px-3 py-2.5 text-nova-gray whitespace-nowrap">{{ c.createdAt | date:'dd/MM/yyyy HH:mm' }}</td>
                <td class="px-3 py-2.5 text-nova-dark">{{ c.subject }}</td>
                <td class="px-3 py-2.5 text-center text-nova-gray">{{ c.recipients }}</td>
                <td class="px-3 py-2.5 text-center text-green-700">{{ c.sent }}</td>
                <td class="px-3 py-2.5 text-center" [class.text-red-600]="c.failed > 0">{{ c.failed }}</td>
                <td class="px-3 py-2.5">
                  <span class="px-2 py-0.5 rounded text-xs" [class]="c.status === 'SENDING' ? 'bg-yellow-100 text-yellow-800' : 'bg-green-100 text-green-700'">
                    {{ c.status === 'SENDING' ? 'Enviando…' : 'Enviada' }}
                  </span>
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    </div>
  `,
  styles: [`
    .input { @apply w-full border border-nova-blush rounded px-3 py-2 bg-white focus:outline-none focus:border-nova-rose; }
  `],
})
export class AdminCampaignsComponent implements OnInit, OnDestroy {
  info: CampaignsInfo | null = null;
  draft = emptyDraft();
  testTo = '';
  busy = false;
  message = '';
  error = '';
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(private api: ApiService) {}

  ngOnInit() { this.load(); }
  ngOnDestroy() { this.stopPolling(); }

  get valid() { return !!(this.draft.subject.trim() && this.draft.title.trim() && this.draft.message.trim()); }
  get sending() { return !!this.info?.campaigns.some(c => c.status === 'SENDING'); }
  get paragraphs() { return (this.draft.message || 'El texto de tu promoción aparecerá aquí.').split(/\n{2,}/); }

  load() {
    this.api.getCampaigns().subscribe({
      next: info => {
        this.info = info;
        // Mientras una promoción se envía, se actualiza el progreso cada 3 segundos
        if (this.sending && !this.timer) this.timer = setInterval(() => this.load(), 3000);
        if (!this.sending) this.stopPolling();
      },
      error: () => { this.error = 'No se pudo cargar la información de promociones'; },
    });
  }

  private stopPolling() { if (this.timer) { clearInterval(this.timer); this.timer = null; } }

  private payload() {
    const d = this.draft;
    return {
      subject: d.subject.trim(), title: d.title.trim(), message: d.message.trim(),
      discountCode: d.discountCode?.trim() || undefined, buttonText: d.buttonText?.trim() || undefined, buttonUrl: d.buttonUrl?.trim() || undefined,
    };
  }

  sendTest() {
    this.busy = true; this.message = ''; this.error = '';
    this.api.sendTestCampaign({ ...this.payload(), to: this.testTo.trim() || undefined }).subscribe({
      next: r => { this.busy = false; this.message = r.message; },
      error: e => { this.busy = false; this.error = e?.error?.message || 'No se pudo enviar la prueba'; },
    });
  }

  send() {
    const n = this.info?.activeSubscribers ?? 0;
    if (!confirm(`¿Enviar "${this.draft.subject}" a ${n} suscriptores? No se puede deshacer.`)) return;
    this.busy = true; this.message = ''; this.error = '';
    this.api.sendCampaign(this.payload()).subscribe({
      next: () => { this.busy = false; this.message = `Enviando la promoción a ${n} suscriptores…`; this.draft = emptyDraft(); this.load(); },
      error: e => { this.busy = false; this.error = e?.error?.message || 'No se pudo enviar la promoción'; },
    });
  }
}
