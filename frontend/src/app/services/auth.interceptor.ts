import { inject } from '@angular/core';
import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { AuthService } from './auth.service';

// Si el backend rechaza el token (caducado o inválido), cierra la sesión y vuelve al login
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error.status === 401 && req.headers.has('Authorization')) {
        auth.logout();
        router.navigate(['/admin/login']);
      }
      return throwError(() => error);
    })
  );
};
