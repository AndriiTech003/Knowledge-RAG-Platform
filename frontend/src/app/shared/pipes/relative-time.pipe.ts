import { Pipe, PipeTransform } from '@angular/core';
import { DEFAULT_LOCALE, activeLocale } from '../../core/i18n/locale';

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

export function toDate(value: string | number | Date | null | undefined): Date | null {
  if (value === null || value === undefined || value === '') return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function intlRelative(date: Date, now: Date, locale: string): string {
  const diff = date.getTime() - now.getTime();
  const abs = Math.abs(diff);
  const format = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
  if (abs < 45_000) return format.format(0, 'second');
  if (abs < HOUR) return format.format(Math.sign(diff) * Math.max(1, Math.round(abs / MINUTE)), 'minute');
  if (abs < DAY) return format.format(Math.round(diff / HOUR), 'hour');
  const days = Math.round(diff / DAY);
  if (Math.abs(days) < 7) return format.format(days, 'day');
  if (Math.abs(days) < 30) return format.format(Math.round(days / 7), 'week');
  return date.toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' });
}

export function formatRelativeTime(
  value: string | number | Date | null | undefined,
  now: Date = new Date(),
  locale: string = activeLocale(),
): string {
  const date = toDate(value);
  if (!date) return '';
  if (locale !== DEFAULT_LOCALE) return intlRelative(date, now, locale);
  const diff = now.getTime() - date.getTime();
  const future = diff < 0;
  const abs = Math.abs(diff);
  const suffix = (text: string) => (future ? `in ${text}` : `${text} ago`);
  if (abs < 45_000) return 'just now';
  if (abs < HOUR) return suffix(`${Math.max(1, Math.round(abs / MINUTE))} min`);
  if (abs < DAY) return suffix(`${Math.round(abs / HOUR)} h`);
  const days = Math.round(abs / DAY);
  if (days === 1) return future ? 'tomorrow' : 'yesterday';
  if (days < 7) return suffix(`${days} days`);
  if (days < 30) {
    const weeks = Math.round(days / 7);
    return suffix(`${weeks} ${weeks === 1 ? 'week' : 'weeks'}`);
  }
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

@Pipe({ name: 'relativeTime' })
export class RelativeTimePipe implements PipeTransform {
  transform(value: string | number | Date | null | undefined, now?: Date): string {
    return formatRelativeTime(value, now ?? new Date());
  }
}
