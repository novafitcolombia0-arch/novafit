import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-about',
  standalone: true,
  imports: [RouterLink],
  template: `
    <section class="max-w-3xl mx-auto px-4 py-16">
      <p class="text-sm uppercase tracking-widest text-nova-rose text-center mb-3">Conócenos</p>
      <h1 class="font-display text-3xl md:text-4xl font-bold text-center text-nova-dark mb-10">Una historia que nació de un sueño.</h1>

      <div class="space-y-5 text-nova-gray leading-relaxed">
        <p>Soy Melisa, fundadora de NOVA FIT, una marca colombiana que nació en 2021 de un sueño muy personal: crear mi propia marca de ropa deportiva y construirla desde cero.</p>
        <p>Mis primeros pasos fueron revendiendo prendas, pero siempre tuve claro que quería ir más allá. Soñaba con crear mis propios diseños, elegir las telas y darle vida a cada idea.</p>
        <p>Soy empírica y gran parte de lo que sé lo he aprendido a través de la experiencia. Con el tiempo descubrí que una de mis mayores pasiones está detrás de cada prenda: conocer las telas, entender sus composiciones, encontrar texturas y materiales que se adapten a las necesidades de cada mujer y transformar todo eso en diseños que tengan nuestra esencia.</p>
        <p>Hoy, NOVA FIT es mucho más que un emprendimiento. Es un proyecto que crece conmigo, que evoluciona con cada colección y que me reta a aprender, crear e innovar constantemente.</p>
        <p>Nos apasiona el mundo deportivo, pero también creemos en la versatilidad, la feminidad y en esas prendas que te hacen sentir segura y cómoda dentro y fuera del entrenamiento.</p>
        <p>Gracias por ser parte de este sueño y permitirnos crecer contigo.</p>
      </div>

      <div class="mt-10 text-nova-dark">
        <p class="text-nova-gray">Con cariño,</p>
        <p class="font-semibold mt-2">Melisa</p>
        <p class="text-sm text-nova-gray">Fundadora de NOVA FIT</p>
      </div>

      <p class="mt-12 text-center text-lg uppercase tracking-widest text-nova-dark">Muestra tu mejor versión.</p>
      <div class="text-center mt-8">
        <a routerLink="/catalogo" class="inline-block bg-nova-dark text-white px-8 py-3 text-sm uppercase tracking-widest hover:bg-opacity-90 transition">Shop Now</a>
      </div>
    </section>
  `,
})
export class AboutComponent {}
