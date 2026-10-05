export function stripMarkdown(text: string): string {
  return text
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/[*_`>|]/g, ' ')
    .replace(/\[(\d+)\]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function highlightPhrase(chunkText: string | null | undefined, words = 8): string {
  if (!chunkText) return '';
  const lines = chunkText
    .split(/\n+/)
    .map((line) => stripMarkdown(line))
    .filter((line) => line.length > 0 && !/^[-:\s]+$/.test(line));
  if (lines.length === 0) return '';
  const best = lines.reduce((a, b) => (b.length > a.length ? b : a));
  const sentence = best.split(/(?<=[.!?])\s+/)[0] ?? best;
  return sentence.split(' ').slice(0, words).join(' ').replace(/[.,;:]+$/, '');
}

export function highlightInText(text: string, start: number | null, end: number | null): { before: string; match: string; after: string } {
  if (start === null || end === null || start < 0 || end <= start || start >= text.length) {
    return { before: text, match: '', after: '' };
  }
  return { before: text.slice(0, start), match: text.slice(start, Math.min(end, text.length)), after: text.slice(Math.min(end, text.length)) };
}
