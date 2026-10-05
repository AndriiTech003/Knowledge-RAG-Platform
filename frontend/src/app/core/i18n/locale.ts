import { registerLocaleData } from '@angular/common';
import { loadTranslations } from '@angular/localize';

export type AppLocale = 'en' | 'uk';

export const SUPPORTED_LOCALES: readonly AppLocale[] = ['en', 'uk'];
export const DEFAULT_LOCALE: AppLocale = 'en';
export const LOCALE_STORAGE_KEY = 'kb.locale';

export const LOCALE_NAMES: Record<AppLocale, string> = {
  en: 'English',
  uk: 'Українська',
};

export type Translations = Record<string, string>;

let active: AppLocale = DEFAULT_LOCALE;

export function activeLocale(): AppLocale {
  return active;
}

export function isAppLocale(value: unknown): value is AppLocale {
  return typeof value === 'string' && (SUPPORTED_LOCALES as readonly string[]).includes(value);
}

export function resolveLocale(stored: string | null, browser: readonly string[] = []): AppLocale {
  if (isAppLocale(stored)) return stored;
  for (const tag of browser) {
    const base = tag.toLowerCase().split('-')[0];
    if (isAppLocale(base)) return base;
  }
  return DEFAULT_LOCALE;
}

export function readStoredLocale(storage: Pick<Storage, 'getItem'> | null = safeStorage()): string | null {
  try {
    return storage?.getItem(LOCALE_STORAGE_KEY) ?? null;
  } catch {
    return null;
  }
}

export function storeLocale(locale: AppLocale, storage: Pick<Storage, 'setItem'> | null = safeStorage()): void {
  try {
    storage?.setItem(LOCALE_STORAGE_KEY, locale);
  } catch {
    return;
  }
}

export function translationsUrl(locale: AppLocale): string {
  return `/i18n/messages.${locale}.json`;
}

export async function fetchTranslations(locale: AppLocale, fetcher: typeof fetch = fetch): Promise<Translations> {
  const response = await fetcher(translationsUrl(locale), { cache: 'no-cache' });
  if (!response.ok) throw new Error(`translations for ${locale} unavailable (${response.status})`);
  const body = (await response.json()) as { translations?: Translations };
  return body.translations ?? {};
}

export function applyLocale(locale: AppLocale, translations: Translations, localeData?: unknown[]): void {
  if (localeData) registerLocaleData(localeData, locale);
  if (locale !== DEFAULT_LOCALE) loadTranslations(translations);
  active = locale;
  if (typeof document !== 'undefined') document.documentElement.lang = locale;
}

export async function initLocale(fetcher: typeof fetch = fetch): Promise<AppLocale> {
  const browser = typeof navigator === 'undefined' ? [] : navigator.languages ?? [navigator.language];
  const locale = resolveLocale(readStoredLocale(), browser);
  if (locale === DEFAULT_LOCALE) {
    applyLocale(locale, {});
    return locale;
  }
  try {
    const [translations, data] = await Promise.all([fetchTranslations(locale, fetcher), import('@angular/common/locales/uk')]);
    applyLocale(locale, translations, data.default);
    return locale;
  } catch (error: unknown) {
    console.warn('falling back to English', error);
    applyLocale(DEFAULT_LOCALE, {});
    return DEFAULT_LOCALE;
  }
}

function safeStorage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}
