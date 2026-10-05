import { escapeHtml } from '../../shared/pipes/highlight.pipe';

export function uncitedTip(): string {
  return $localize`:@@chat.message.uncitedTip:No source supports this statement`;
}

const CITATION_GROUP = /\[(\d{1,3}(?:\s*[,;]\s*\d{1,3})*)\](?!\()/g;

export function citationNumbers(text: string): number[] {
  const out = new Set<number>();
  for (const match of text.matchAll(CITATION_GROUP)) {
    for (const part of match[1].split(/[,;]/)) {
      const n = Number.parseInt(part.trim(), 10);
      if (Number.isFinite(n)) out.add(n);
    }
  }
  return [...out].sort((a, b) => a - b);
}

export function replaceCitations(text: string): string {
  return text.replace(CITATION_GROUP, (_match, group: string) =>
    group
      .split(/[,;]/)
      .map((part) => Number.parseInt(part.trim(), 10))
      .filter((n) => Number.isFinite(n))
      .map((n) => `<span class="kb-cite" data-n="${n}"></span>`)
      .join(''),
  );
}

export function markUncitedClaims(text: string, claims: string[]): string {
  let out = text;
  const tip = escapeHtml(uncitedTip());
  for (const claim of claims) {
    const trimmed = claim.trim();
    if (trimmed.length < 8) continue;
    const index = out.indexOf(trimmed);
    if (index === -1) continue;
    const wrapped = `<span class="kb-uncited" tabindex="0" data-tip="${tip}" title="${tip}">${trimmed}</span>`;
    out = out.slice(0, index) + wrapped + out.slice(index + trimmed.length);
  }
  return out;
}

export function renderableMarkdown(content: string, uncitedClaims: string[] = []): string {
  const segments = content.split(/(```[\s\S]*?```)/g);
  return segments
    .map((segment) => (segment.startsWith('```') ? segment : replaceCitations(markUncitedClaims(segment, uncitedClaims))))
    .join('');
}
