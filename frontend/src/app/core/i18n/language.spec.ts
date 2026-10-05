import { TestBed } from '@angular/core/testing';
import { clearTranslations } from '@angular/localize';
import { render, screen } from '@testing-library/angular';
import { provideRouter } from '@angular/router';
import uk from '../../../locale/messages.uk.json';
import { ForbiddenPage } from '../layout/status-pages';
import { formatRelativeTime } from '../../shared/pipes/relative-time.pipe';
import { statusLabel } from '../../shared/ui/status-badge';
import { LanguageService, PAGE_RELOAD } from './language.service';
import {
  LOCALE_STORAGE_KEY,
  activeLocale,
  applyLocale,
  initLocale,
  readStoredLocale,
  resolveLocale,
  translationsUrl,
} from './locale';
import { plural } from './plural';

function fetchReturning(body: unknown, ok = true): typeof fetch {
  return vi.fn(async () => new Response(JSON.stringify(body), { status: ok ? 200 : 404 })) as unknown as typeof fetch;
}

describe('locale resolution', () => {
  afterEach(() => localStorage.clear());

  it('prefers a stored choice, then the browser language, then English', () => {
    expect(resolveLocale('uk', ['en-US'])).toBe('uk');
    expect(resolveLocale('en', ['uk-UA'])).toBe('en');
    expect(resolveLocale(null, ['de-DE', 'uk-UA'])).toBe('uk');
    expect(resolveLocale('fr', ['fr-FR'])).toBe('en');
    expect(resolveLocale(null, [])).toBe('en');
  });

  it('reads the persisted locale and survives a broken storage', () => {
    localStorage.setItem(LOCALE_STORAGE_KEY, 'uk');
    expect(readStoredLocale()).toBe('uk');
    expect(readStoredLocale({ getItem: () => { throw new Error('denied'); } })).toBeNull();
  });
});

describe('LanguageService', () => {
  afterEach(() => localStorage.clear());

  it('persists the chosen language and reloads the page to apply it', () => {
    const reload = vi.fn();
    TestBed.configureTestingModule({ providers: [{ provide: PAGE_RELOAD, useValue: reload }] });
    const service = TestBed.inject(LanguageService);
    expect(service.current()).toBe('en');
    expect(service.options.map((o) => o.name)).toEqual(['English', 'Українська']);
    service.switchTo('uk');
    expect(localStorage.getItem(LOCALE_STORAGE_KEY)).toBe('uk');
    expect(service.current()).toBe('uk');
    expect(reload).toHaveBeenCalledTimes(1);
    service.switchTo('uk');
    expect(reload).toHaveBeenCalledTimes(1);
  });
});

describe('switching to Ukrainian', () => {
  afterEach(() => {
    clearTranslations();
    applyLocale('en', {});
    localStorage.clear();
  });

  it('loads the stored locale before bootstrap and translates messages', async () => {
    localStorage.setItem(LOCALE_STORAGE_KEY, 'uk');
    const fetcher = fetchReturning(uk);
    expect(await initLocale(fetcher)).toBe('uk');
    expect(fetcher).toHaveBeenCalledWith(translationsUrl('uk'), expect.anything());
    expect(activeLocale()).toBe('uk');
    expect(document.documentElement.lang).toBe('uk');
    expect($localize`:@@shell.nav.chat:Chat`).toBe('Чат');
    expect(statusLabel('ready')).toBe('Готово');
    expect(plural(5, { one: '{count} файл', few: '{count} файли', many: '{count} файлів', other: '{count} файлу' })).toBe('5 файлів');
    expect(formatRelativeTime('2026-10-02T11:55:00Z', new Date('2026-10-02T12:00:00Z'))).toBe('5 хвилин тому');
  });

  it('renders templates in Ukrainian', async () => {
    applyLocale('uk', uk.translations);
    await render(ForbiddenPage, { providers: [provideRouter([])] });
    expect(screen.getByRole('heading')).toHaveTextContent('Доступ заборонено');
    expect(screen.getByRole('link')).toHaveTextContent('Повернутися до чату');
  });

  it('falls back to English when the catalog cannot be loaded', async () => {
    localStorage.setItem(LOCALE_STORAGE_KEY, 'uk');
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    expect(await initLocale(fetchReturning({}, false))).toBe('en');
    expect($localize`:@@shell.nav.chat:Chat`).toBe('Chat');
    expect(warn).toHaveBeenCalled();
  });
});
