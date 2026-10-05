import { Injectable, inject } from '@angular/core';
import { OidcSecurityService } from 'angular-auth-oidc-client';
import { Observable, map, take } from 'rxjs';
import { AccessTokenProvider } from './access-token';
import { AuthFacade } from './auth.facade';

export function groupsFromPayload(payload: { groups?: unknown } | null | undefined): string[] {
  const raw = payload?.groups;
  return Array.isArray(raw) ? raw.filter((g): g is string => typeof g === 'string').map((g) => g.replace(/^\//, '')) : [];
}

@Injectable()
export class OidcAccessTokenProvider extends AccessTokenProvider {
  private readonly oidc = inject(OidcSecurityService);

  token$(): Observable<string | null> {
    return this.oidc.getAccessToken().pipe(map((token) => token || null));
  }
}

@Injectable()
export class OidcAuthFacade extends AuthFacade {
  private readonly oidc = inject(OidcSecurityService);

  isAuthenticated$(): Observable<boolean> {
    return this.oidc.isAuthenticated$.pipe(
      map((r) => r.isAuthenticated),
      take(1),
    );
  }

  login(returnUrl?: string): void {
    if (returnUrl) this.rememberReturnUrl(returnUrl);
    this.oidc.authorize();
  }

  logout(): void {
    this.oidc.logoff().pipe(take(1)).subscribe({ error: () => this.oidc.logoffLocal() });
  }

  tokenGroups(): string[] {
    let groups: string[] = [];
    this.oidc
      .getPayloadFromAccessToken()
      .pipe(take(1))
      .subscribe((payload: { groups?: unknown } | null) => {
        groups = groupsFromPayload(payload);
      });
    return groups;
  }
}
