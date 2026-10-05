import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, Router, RouterStateSnapshot, UrlTree, provideRouter } from '@angular/router';
import { Observable, of } from 'rxjs';
import { MeOut } from '../api/models/me-out';
import { MeService } from '../api/services/me.service';
import { authGuard } from './auth.guard';
import { AuthFacade } from './auth.facade';
import { roleGuard } from './role.guard';

class FakeAuth extends AuthFacade {
  authenticated = true;
  groups: string[] = [];
  login = vi.fn();
  logout = vi.fn();
  isAuthenticated$(): Observable<boolean> {
    return of(this.authenticated);
  }
  tokenGroups(): string[] {
    return this.groups;
  }
}

function me(groups: string[], isAdmin = false): MeOut {
  return { sub: 's', email: null, name: 'Test', username: 't', groups, is_admin: isAdmin, collections: [] };
}

function setup(meResult: MeOut | Error) {
  const auth = new FakeAuth();
  const getMe = vi.fn(() => (meResult instanceof Error ? new Observable<MeOut>((s) => s.error(meResult)) : of(meResult)));
  TestBed.configureTestingModule({
    providers: [provideRouter([]), { provide: AuthFacade, useValue: auth }, { provide: MeService, useValue: { getMe } }],
  });
  return { auth, getMe };
}

const route = {} as ActivatedRouteSnapshot;
const state = (url: string) => ({ url }) as RouterStateSnapshot;

describe('authGuard', () => {
  beforeEach(() => sessionStorage.clear());

  it('allows authenticated users', async () => {
    setup(me([]));
    expect(await TestBed.runInInjectionContext(() => authGuard(route, state('/chat')))).toBe(true);
  });

  it('starts the login flow and remembers the target url', async () => {
    const { auth } = setup(me([]));
    auth.authenticated = false;
    const result = await TestBed.runInInjectionContext(() => authGuard(route, state('/collections/x')));
    expect(result).toBe(false);
    expect(auth.login).toHaveBeenCalledWith('/collections/x');
  });

  it('redirects to the remembered url after login', async () => {
    setup(me([]));
    sessionStorage.setItem('kb.returnUrl', '/search');
    const result = await TestBed.runInInjectionContext(() => authGuard(route, state('/')));
    expect(result instanceof UrlTree && TestBed.inject(Router).serializeUrl(result)).toBe('/search');
    expect(sessionStorage.getItem('kb.returnUrl')).toBeNull();
  });
});

describe('roleGuard', () => {
  it('allows members of the required group', async () => {
    setup(me(['kb-admins'], true));
    expect(await TestBed.runInInjectionContext(() => roleGuard('kb-admins')(route, state('/admin')))).toBe(true);
  });

  it('redirects other users to /forbidden', async () => {
    setup(me(['engineering']));
    const result = await TestBed.runInInjectionContext(() => roleGuard('kb-admins')(route, state('/admin')));
    expect(result instanceof UrlTree && TestBed.inject(Router).serializeUrl(result)).toBe('/forbidden');
  });

  it('falls back to token groups when /me fails', async () => {
    const { auth } = setup(new Error('down'));
    auth.groups = ['finance'];
    expect(await TestBed.runInInjectionContext(() => roleGuard('finance')(route, state('/x')))).toBe(true);
  });
});
