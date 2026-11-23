import { inject } from '@angular/core';
import { Router, CanActivateFn, CanActivateChildFn } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const authGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (auth.isLoggedIn()) {
    return true;
  }
  router.navigate(['/admin/login']);
  return false;
};

/** El usuario de finanzas solo puede entrar a Finanzas; cualquier otra página lo lleva allá */
export const roleGuard: CanActivateChildFn = (_route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (auth.isAdmin() || state.url.startsWith('/admin/finanzas')) return true;
  return router.parseUrl('/admin/finanzas');
};
