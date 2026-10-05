import { inject } from '@angular/core';
import { CanActivateFn, CanMatchFn, Router } from '@angular/router';
import { AuthFacade } from './auth.facade';
import { CurrentUserStore } from './current-user.store';

async function hasRole(group: string): Promise<boolean> {
  const user = inject(CurrentUserStore);
  const auth = inject(AuthFacade);
  const me = await user.ensureLoaded();
  if (me) return user.hasGroup(group);
  return auth.tokenGroups().includes(group);
}

export function roleGuard(group: string): CanActivateFn & CanMatchFn {
  return async () => {
    const router = inject(Router);
    const check = hasRole(group);
    return (await check) ? true : router.parseUrl('/forbidden');
  };
}
