import { Component, inject } from '@angular/core';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter, map } from 'rxjs';
import { NavbarComponent } from './shared/navbar/navbar.component';
import { FooterComponent } from './shared/footer/footer.component';

@Component({
    selector: 'app-root',
    imports: [RouterOutlet, NavbarComponent, FooterComponent],
    template: `
    @if (isAdmin()) {
      <router-outlet></router-outlet>
    } @else {
      <app-navbar></app-navbar>
      <main class="min-h-screen">
        <router-outlet></router-outlet>
      </main>
      <app-footer></app-footer>
    }
  `
})
export class AppComponent {
  private router = inject(Router);
  // El panel de administración tiene su propio menú lateral
  isAdmin = toSignal(
    this.router.events.pipe(
      filter(e => e instanceof NavigationEnd),
      map(() => this.router.url.startsWith('/admin'))
    ),
    { initialValue: location.pathname.startsWith('/admin') }
  );
}
