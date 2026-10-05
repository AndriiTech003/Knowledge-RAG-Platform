import { activeLocale } from './locale';

export interface PluralForms {
  one: string;
  few?: string;
  many?: string;
  other: string;
}

const rulesCache = new Map<string, Intl.PluralRules>();

export function pluralCategory(count: number, locale: string = activeLocale()): Intl.LDMLPluralRule {
  let rules = rulesCache.get(locale);
  if (!rules) {
    rules = new Intl.PluralRules(locale);
    rulesCache.set(locale, rules);
  }
  return rules.select(count);
}

export function plural(count: number, forms: PluralForms, locale: string = activeLocale()): string {
  const category = pluralCategory(count, locale);
  const text = category === 'one' ? forms.one : category === 'few' ? forms.few ?? forms.other : category === 'many' ? forms.many ?? forms.other : forms.other;
  return text.replace(/\{count\}/g, formatNumber(count, locale));
}

export function formatNumber(value: number, locale: string = activeLocale(), options?: Intl.NumberFormatOptions): string {
  return new Intl.NumberFormat(locale, options).format(value);
}
