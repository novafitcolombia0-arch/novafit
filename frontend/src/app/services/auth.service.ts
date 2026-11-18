import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { BehaviorSubject, Observable, tap } from 'rxjs';
import { AuthResponse, User } from '../models/types';
import { environment } from '../../environments/environment';

export const TOKEN_KEY = 'nova_token';
export const USER_KEY = 'nova_user';

/**
 * La sesión del panel vive en sessionStorage: se borra al cerrar la pestaña o el navegador
 * y no se comparte entre pestañas, así una sesión olvidada en un equipo no queda abierta.
 */
const session = {
  get: (k: string) => { try { return sessionStorage.getItem(k); } catch { return null; } },
  set: (k: string, v: string) => { try { sessionStorage.setItem(k, v); } catch {} },
  remove: (k: string) => { try { sessionStorage.removeItem(k); } catch {} },
};

@Injectable({ providedIn: 'root' })
export class AuthService {
  private apiUrl = `${environment.apiUrl}/auth`;
  private userSubject = new BehaviorSubject<User | null>(null);
  user$ = this.userSubject.asObservable();

  constructor(private http: HttpClient) {
    // Borra la sesión que versiones anteriores guardaban en localStorage
    try { localStorage.removeItem(TOKEN_KEY); localStorage.removeItem(USER_KEY); } catch {}

    const token = session.get(TOKEN_KEY);
    const user = session.get(USER_KEY);
    if (token && user) {
      try { this.userSubject.next(JSON.parse(user)); } catch {}
    }
  }

  login(email: string, password: string): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.apiUrl}/login`, { email, password })
      .pipe(
        tap(res => {
          session.set(TOKEN_KEY, res.token);
          session.set(USER_KEY, JSON.stringify(res.user));
          this.userSubject.next(res.user);
        })
      );
  }

  setToken(token: string) {
    session.set(TOKEN_KEY, token);
  }

  /** Correo del admin con sesión abierta (para mostrarlo en el panel) */
  currentEmail(): string {
    try { return JSON.parse(session.get(USER_KEY) || '{}').email || ''; } catch { return ''; }
  }

  logout() {
    session.remove(TOKEN_KEY);
    session.remove(USER_KEY);
    this.userSubject.next(null);
  }

  getToken(): string | null {
    return session.get(TOKEN_KEY);
  }

  isLoggedIn(): boolean {
    const token = this.getToken();
    if (!token) return false;
    try {
      const payload = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
      const { exp } = JSON.parse(atob(payload));
      return exp * 1000 > Date.now();
    } catch {
      return false;
    }
  }

  getHeaders(): HttpHeaders {
    return new HttpHeaders({
      Authorization: `Bearer ${this.getToken()}`,
    });
  }
}
