import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../../services/auth.service';

@Component({
  selector: 'app-admin-login',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="nova-admin min-h-screen grid lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] bg-[#f4f3f0]">
      <!-- Marca -->
      <section class="relative hidden lg:flex flex-col justify-between bg-[#1e1e1e] text-white p-12 overflow-hidden">
        <img src="assets/logo-white.png" alt="Nova FIT" class="h-12 w-auto self-start">
        <div class="relative z-10 max-w-sm">
          <p class="text-[34px] leading-[1.15] font-bold tracking-tight">Tu tienda, tus números y tu inventario en un solo lugar.</p>
          <p class="text-[#a8a49c] mt-4">Pedidos, finanzas y existencias de Nova FIT.</p>
        </div>
        <img src="assets/monogram-white.png" alt="" aria-hidden="true"
             class="pointer-events-none select-none absolute -right-24 -bottom-24 w-[420px] opacity-[0.06]">
      </section>

      <!-- Formulario -->
      <section class="flex items-center justify-center px-6 py-16">
        <div class="w-full max-w-[380px]">
          <img src="assets/logo-black.png" alt="Nova FIT" class="h-10 w-auto mb-10 lg:hidden">
          <h1 class="text-[28px] font-bold tracking-tight mb-1">Ingresa al panel</h1>
          <p class="text-[#6b6862] mb-8">Usa tu correo y contraseña de administradora.</p>

          @if (error) {
            <div class="bg-[#fbeceb] text-[#b3372f] px-4 py-3 rounded-lg mb-5 text-sm" role="alert">{{ error }}</div>
          }

          <form (submit)="login()" class="space-y-5">
            <div>
              <label for="email" class="block text-sm font-medium mb-1.5">Correo</label>
              <input id="email" type="email" [(ngModel)]="email" name="email" autocomplete="username" required
                     class="w-full border px-3.5 py-2.5 text-[15px]">
            </div>
            <div>
              <label for="password" class="block text-sm font-medium mb-1.5">Contraseña</label>
              <div class="relative">
                <input id="password" [type]="show ? 'text' : 'password'" [(ngModel)]="password" name="password"
                       autocomplete="current-password" required class="w-full border px-3.5 py-2.5 pr-20 text-[15px]">
                <button type="button" (click)="show = !show"
                        class="absolute right-2 top-1/2 -translate-y-1/2 text-[13px] text-[#6b6862] hover:text-[#1e1e1e] px-2 py-1">
                  {{ show ? 'Ocultar' : 'Mostrar' }}
                </button>
              </div>
            </div>
            <button type="submit" [disabled]="loading"
                    class="w-full bg-nova-dark text-white py-3 font-semibold text-[15px] hover:bg-black transition disabled:opacity-50">
              {{ loading ? 'Ingresando…' : 'Ingresar' }}
            </button>
          </form>
          <a href="/" class="inline-block mt-8 text-sm text-[#6b6862] hover:text-[#1e1e1e]">Volver a la tienda</a>
        </div>
      </section>
    </div>
  `,
})
export class AdminLoginComponent {
  email = '';
  password = '';
  error = '';
  loading = false;
  show = false;

  constructor(private auth: AuthService, private router: Router) {}

  login() {
    this.loading = true;
    this.error = '';
    this.auth.login(this.email, this.password).subscribe({
      next: () => this.router.navigate(['/admin']),
      error: (err) => {
        this.error = err?.status === 429
          ? (err?.error?.message || 'Demasiados intentos. Espera unos minutos.')
          : 'El correo o la contraseña no coinciden. Revísalos e intenta de nuevo.';
        this.loading = false;
      },
    });
  }
}
