import { DOCUMENT, Injectable, InjectionToken, inject, signal } from '@angular/core';
import { AppLocale, LOCALE_NAMES, SUPPORTED_LOCALES, activeLocale, storeLocale } from './locale';

export const PAGE_RELOAD = new InjectionToken<() => void>('PAGE_RELOAD', {
  providedIn: 'root',
  factory: () => {
    const location = inject(DOCUMENT).defaultView?.location;
    return () => location?.reload();
  },
});

export interface LanguageOption {
  code: AppLocale;
  name: string;
}

@Injectable({ providedIn: 'root' })
export class LanguageService {
  private readonly reload = inject(PAGE_RELOAD);
  readonly current = signal<AppLocale>(activeLocale());
  readonly options: LanguageOption[] = SUPPORTED_LOCALES.map((code) => ({ code, name: LOCALE_NAMES[code] }));

  switchTo(locale: AppLocale): void {
    storeLocale(locale);
    if (locale === this.current()) return;
    this.current.set(locale);
    this.reload();
  }
}
