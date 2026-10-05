import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { AuthFacade } from './auth.facade';

export const authGuard: CanActivateFn = async (_route, state) => {
  const auth = inject(AuthFacade);
  const router = inject(Router);
  const authenticated = await firstValueFrom(auth.isAuthenticated$());
  if (!authenticated) {
    auth.login(state.url);
    return false;
  }
  const returnUrl = auth.consumeReturnUrl();
  if (returnUrl && returnUrl !== state.url) return router.parseUrl(returnUrl);
  return true;
};
