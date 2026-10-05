import { FileSizePipe, formatFileSize } from './file-size.pipe';
import { highlightTerms, HighlightPipe } from './highlight.pipe';
import { formatRelativeTime, RelativeTimePipe } from './relative-time.pipe';

const NOW = new Date('2026-10-02T12:00:00Z');

describe('relativeTime', () => {
  it.each([
    ['2026-10-02T11:59:50Z', 'just now'],
    ['2026-10-02T11:55:00Z', '5 min ago'],
    ['2026-10-02T09:00:00Z', '3 h ago'],
    ['2026-10-01T10:00:00Z', 'yesterday'],
    ['2026-09-28T12:00:00Z', '4 days ago'],
    ['2026-09-18T12:00:00Z', '2 weeks ago'],
    ['2026-10-02T12:10:00Z', 'in 10 min'],
  ])('%s -> %s', (input, expected) => {
    expect(formatRelativeTime(input, NOW)).toBe(expected);
  });

  it('formats old dates as calendar dates and tolerates invalid input', () => {
    expect(formatRelativeTime('2025-01-15T00:00:00Z', NOW)).toBe('15 Jan 2025');
    expect(formatRelativeTime('nonsense', NOW)).toBe('');
    expect(new RelativeTimePipe().transform(null)).toBe('');
  });
});

describe('fileSize', () => {
  it.each([
    [0, '0 B'],
    [1023, '1023 B'],
    [1536, '1.5 KB'],
    [1048576, '1 MB'],
    [5 * 1024 * 1024 * 1024, '5 GB'],
    [150 * 1024, '150 KB'],
  ])('%d -> %s', (bytes, expected) => {
    expect(formatFileSize(bytes)).toBe(expected);
  });

  it('returns an empty string for invalid sizes', () => {
    expect(new FileSizePipe().transform(-1)).toBe('');
    expect(new FileSizePipe().transform(null)).toBe('');
  });
});

describe('highlight', () => {
  it('wraps matching terms in <mark> case-insensitively', () => {
    expect(highlightTerms('Travel policy for Europe', 'travel europe')).toBe('<mark>Travel</mark> policy for <mark>Europe</mark>');
  });

  it('escapes HTML before highlighting', () => {
    expect(highlightTerms('<b>budget</b>', 'budget')).toBe('&lt;b&gt;<mark>budget</mark>&lt;/b&gt;');
  });

  it('escapes regex characters in the query and ignores very short terms', () => {
    expect(highlightTerms('cost (USD) a', '(USD) a')).toBe('cost <mark>(USD)</mark> a');
    expect(new HighlightPipe().transform('plain', '')).toBe('plain');
  });
});
