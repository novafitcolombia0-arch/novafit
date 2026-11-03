import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../../services/auth.service';

@Component({
  selector: 'app-admin-login',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="min-h-screen flex items-center justify-center bg-nova-cream">
      <div class="bg-white p-8 rounded-lg shadow-md w-full max-w-md">
        <h1 class="font-display text-2xl font-bold text-center mb-6 text-nova-dark">Nova Admin</h1>
        @if (error) {
          <div class="bg-red-50 text-red-600 p-3 rounded mb-4 text-sm">{{ error }}</div>
        }
        <form (submit)="login()">
          <div class="mb-4">
            <label class="block text-sm font-medium mb-1 text-nova-dark">Email</label>
            <input type="email" [(ngModel)]="email" name="email"
                   class="w-full border border-nova-blush rounded px-3 py-2 focus:outline-none focus:border-nova-rose" required>
          </div>
          <div class="mb-6">
            <label class="block text-sm font-medium mb-1 text-nova-dark">Contraseña</label>
            <input type="password" [(ngModel)]="password" name="password"
                   class="w-full border border-nova-blush rounded px-3 py-2 focus:outline-none focus:border-nova-rose" required>
          </div>
          <button type="submit" [disabled]="loading"
                  class="w-full bg-nova-dark text-white py-3 rounded font-medium text-sm uppercase tracking-wider hover:bg-nova-black transition disabled:opacity-50">
            {{ loading ? 'Ingresando...' : 'Ingresar' }}
          </button>
        </form>
      </div>
    </div>
  `,
})
export class AdminLoginComponent {
  email = '';
  password = '';
  error = '';
  loading = false;

  constructor(private auth: AuthService, private router: Router) {}

  login() {
    this.loading = true;
    this.error = '';
    this.auth.login(this.email, this.password).subscribe({
      next: () => this.router.navigate(['/admin']),
      error: () => { this.error = 'Credenciales inválidas'; this.loading = false; },
    });
  }
}
