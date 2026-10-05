import { Observable } from 'rxjs';

export const RETURN_URL_KEY = 'kb.returnUrl';

export abstract class AuthFacade {
  abstract isAuthenticated$(): Observable<boolean>;
  abstract login(returnUrl?: string): void;
  abstract logout(): void;
  abstract tokenGroups(): string[];

  consumeReturnUrl(): string | null {
    try {
      const value = sessionStorage.getItem(RETURN_URL_KEY);
      if (value) sessionStorage.removeItem(RETURN_URL_KEY);
      return value;
    } catch {
      return null;
    }
  }

  rememberReturnUrl(url: string): void {
    try {
      if (url && url !== '/') sessionStorage.setItem(RETURN_URL_KEY, url);
    } catch {
      return;
    }
  }
}
