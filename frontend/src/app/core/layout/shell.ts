import { BreakpointObserver } from '@angular/cdk/layout';
import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatDividerModule } from '@angular/material/divider';
import { MatIconModule, MatIconRegistry } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { MatMenuModule } from '@angular/material/menu';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter, map } from 'rxjs';
import { AuthFacade } from '../auth/auth.facade';
import { LanguageService } from '../i18n/language.service';
import { CurrentUserStore } from '../auth/current-user.store';
import { ThemeService } from './theme.service';

interface NavItem {
  path: string;
  label: string;
  icon: string;
  testId: string;
}

@Component({
  selector: 'kb-shell',
  imports: [
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    MatSidenavModule,
    MatToolbarModule,
    MatListModule,
    MatIconModule,
    MatButtonModule,
    MatMenuModule,
    MatTooltipModule,
    MatDividerModule,
  ],
  templateUrl: './shell.html',
  styleUrl: './shell.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '(document:keydown)': 'onKeydown($event)',
  },
})
export class Shell implements OnInit {
  protected readonly user = inject(CurrentUserStore);
  protected readonly theme = inject(ThemeService);
  protected readonly language = inject(LanguageService);
  private readonly auth = inject(AuthFacade);
  private readonly router = inject(Router);
  private readonly breakpoints = inject(BreakpointObserver);

  protected readonly handset = toSignal(this.breakpoints.observe('(max-width: 900px)').pipe(map((r) => r.matches)), {
    initialValue: false,
  });
  protected readonly navOpen = signal(true);
  protected readonly sidenavMode = computed(() => (this.handset() ? 'over' : 'side'));
  protected readonly mobileOpen = signal(false);
  private readonly url = toSignal(
    this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      map((e) => e.urlAfterRedirects),
    ),
    { initialValue: this.router.url },
  );
  protected readonly inAdmin = computed(() => this.url().startsWith('/admin'));

  protected readonly mainNav: NavItem[] = [
    { path: '/chat', label: $localize`:@@shell.nav.chat:Chat`, icon: 'forum', testId: 'nav-chat' },
    { path: '/search', label: $localize`:@@shell.nav.search:Search`, icon: 'manage_search', testId: 'nav-search' },
    { path: '/collections', label: $localize`:@@shell.nav.collections:Collections`, icon: 'folder_copy', testId: 'nav-collections' },
  ];

  protected readonly adminNav: NavItem[] = [
    { path: '/admin/overview', label: $localize`:@@shell.nav.overview:Overview`, icon: 'monitoring', testId: 'nav-admin-overview' },
    { path: '/admin/unanswered', label: $localize`:@@shell.nav.unanswered:Unanswered`, icon: 'help', testId: 'nav-admin-unanswered' },
    { path: '/admin/feedback', label: $localize`:@@shell.nav.feedback:Negative feedback`, icon: 'thumb_down', testId: 'nav-admin-feedback' },
    { path: '/admin/query-logs', label: $localize`:@@shell.nav.traces:Query traces`, icon: 'timeline', testId: 'nav-admin-traces' },
    { path: '/admin/eval', label: $localize`:@@shell.nav.eval:Eval`, icon: 'science', testId: 'nav-admin-eval' },
  ];

  protected readonly themeLabel = computed(() =>
    this.theme.mode() === 'dark'
      ? $localize`:@@shell.theme.toLight:Switch to light theme`
      : $localize`:@@shell.theme.toDark:Switch to dark theme`,
  );

  constructor() {
    inject(MatIconRegistry).setDefaultFontSetClass('material-symbols-outlined');
  }

  ngOnInit(): void {
    void this.user.ensureLoaded();
  }

  protected opened(): boolean {
    return this.handset() ? this.mobileOpen() : this.navOpen();
  }

  protected toggleNav(): void {
    if (this.handset()) this.mobileOpen.update((v) => !v);
    else this.navOpen.update((v) => !v);
  }

  protected closeOnHandset(): void {
    if (this.handset()) this.mobileOpen.set(false);
  }

  protected logout(): void {
    this.user.clear();
    this.auth.logout();
  }

  protected onKeydown(event: KeyboardEvent): void {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      void this.router.navigate(['/chat'], { queryParams: { new: Date.now() } });
    }
  }
}
