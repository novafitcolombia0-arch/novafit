import { Component } from '@angular/core';

@Component({
  selector: 'app-policies',
  standalone: true,
  template: `
    <section class="max-w-3xl mx-auto px-4 py-16 text-nova-gray leading-relaxed">
      <h1 class="font-display text-3xl md:text-4xl font-bold text-center text-nova-dark mb-12">Garantías y Cambios</h1>

      <h2 class="text-lg font-semibold text-nova-dark mb-2">1. Garantías</h2>
      <p class="mb-8">Nuestras prendas cuentan con garantía por defectos de fabricación, como fallas en costuras, telas o confección. Para solicitar una revisión, es necesario comunicarse con nuestro equipo y enviar evidencia fotográfica del defecto.</p>

      <h2 class="text-lg font-semibold text-nova-dark mb-2">2. Cambios de talla o referencia</h2>
      <ul class="list-disc pl-5 space-y-1 mb-8">
        <li>Los cambios deben solicitarse dentro de los 8 días calendario siguientes a la recepción del pedido.</li>
        <li>Las prendas deben estar en perfecto estado, sin uso, sin lavar, sin olores y con sus etiquetas originales.</li>
        <li>Los cambios están sujetos a disponibilidad de inventario.</li>
        <li>Los costos de envío por cambios de talla o referencia corren por cuenta del cliente.</li>
      </ul>

      <h2 class="text-lg font-semibold text-nova-dark mb-2">3. Condiciones de los cambios</h2>
      <ul class="list-disc pl-5 space-y-1 mb-8">
        <li>No realizamos cambios en prendas adquiridas en promoción o con descuento.</li>
        <li>La nueva prenda debe tener un valor igual o superior al de la prenda adquirida inicialmente.</li>
        <li>Si la nueva prenda tiene un valor superior, el cliente deberá pagar la diferencia.</li>
        <li>No manejamos saldos a favor por diferencias de precio.</li>
      </ul>

      <h2 class="text-lg font-semibold text-nova-dark mb-2">4. Devoluciones de dinero</h2>
      <p class="mb-8">NOVA FIT no realiza devoluciones de dinero por cambios voluntarios de talla, referencia o preferencia personal.</p>

      <h2 class="text-lg font-semibold text-nova-dark mb-2">5. Importante</h2>
      <p class="mb-12">Las condiciones comerciales anteriores no limitan los derechos del consumidor establecidos por la legislación colombiana, incluyendo las garantías legales, el derecho de retracto cuando aplique y las devoluciones exigidas por ley.</p>

      <div class="border border-nova-blush rounded-lg p-6">
        <h2 class="text-lg font-semibold text-nova-dark mb-3">Atención al cliente</h2>
        <p>WhatsApp: <a href="https://wa.me/573187016549" target="_blank" rel="noopener" class="text-nova-dark underline hover:text-nova-rose">+57 318 701 6549</a></p>
        <p>Correo: <a href="mailto:novafitcolombia0@gmail.com" class="text-nova-dark underline hover:text-nova-rose">novafitcolombia0&#64;gmail.com</a></p>
      </div>
    </section>
  `,
})
export class PoliciesComponent {}
