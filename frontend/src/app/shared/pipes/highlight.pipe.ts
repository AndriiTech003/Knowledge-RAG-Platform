import { Pipe, PipeTransform } from '@angular/core';

const ENTITIES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

export function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (ch) => ENTITIES[ch] ?? ch);
}

export function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function highlightTerms(text: string | null | undefined, query: string | string[] | null | undefined, minLength = 2): string {
  const source = escapeHtml(text ?? '');
  const terms = (Array.isArray(query) ? query : (query ?? '').split(/\s+/))
    .map((t) => t.trim())
    .filter((t) => t.length >= minLength)
    .map((t) => escapeRegExp(escapeHtml(t)));
  if (!source || terms.length === 0) return source;
  const unique = [...new Set(terms)].sort((a, b) => b.length - a.length);
  return source.replace(new RegExp(`(${unique.join('|')})`, 'gi'), '<mark>$1</mark>');
}

@Pipe({ name: 'highlight' })
export class HighlightPipe implements PipeTransform {
  transform(text: string | null | undefined, query: string | string[] | null | undefined): string {
    return highlightTerms(text, query);
  }
}
