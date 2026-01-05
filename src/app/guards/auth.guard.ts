import { inject } from '@angular/core';
import { CanActivateChildFn, CanActivateFn, Router, UrlTree } from '@angular/router';

import { AuthService } from '../services/auth.service';

const redirectToLogin = (router: Router, target?: string): UrlTree =>
  router.createUrlTree(['/auth/login'], {
    queryParams: target && target !== '/' ? { returnUrl: target } : undefined
  });

const redirectToStudio = (router: Router): UrlTree =>
  router.createUrlTree(['/studio']);

export const authGuard: CanActivateChildFn = (_childRoute, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (auth.isLoggedIn()) {
    return true;
  }

  return redirectToLogin(router, state.url);
};

export const redirectToLoginGuard: CanActivateFn = (_route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (auth.isLoggedIn()) {
    return true;
  }

  return redirectToLogin(router, state.url);
};

/**
 * Guard for auth pages (login, signup, etc.)
 * Redirects logged-in users to studio
 */
export const noAuthGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (auth.isLoggedIn()) {
    return redirectToStudio(router);
  }

  return true;
};
