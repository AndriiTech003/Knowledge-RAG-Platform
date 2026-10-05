import { stepLabel } from './labels';

export interface WaterfallBar {
  step: string;
  label: string;
  start: number;
  duration: number;
  offsetPct: number;
  widthPct: number;
  marker: boolean;
}

export interface Waterfall {
  total: number;
  bars: WaterfallBar[];
}

const SEQUENCE: (string | string[])[] = ['acl', 'condense', 'embed', ['vector', 'lexical'], 'fetch', 'rerank', 'generate'];

function num(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;
}

export function buildWaterfall(timings: Record<string, number> | null | undefined): Waterfall {
  const t = timings ?? {};
  const raw: Omit<WaterfallBar, 'offsetPct' | 'widthPct'>[] = [];
  let cursor = 0;
  for (const entry of SEQUENCE) {
    const steps = Array.isArray(entry) ? entry : [entry];
    let longest = 0;
    for (const step of steps) {
      const duration = num(t[step]);
      if (duration === null) continue;
      raw.push({ step, label: stepLabel(step), start: cursor, duration, marker: false });
      longest = Math.max(longest, duration);
    }
    cursor += longest;
  }
  const firstToken = num(t['first_token']);
  if (firstToken !== null) raw.push({ step: 'first_token', label: stepLabel('first_token'), start: 0, duration: firstToken, marker: true });
  for (const [step, value] of Object.entries(t)) {
    if (step === 'total' || step === 'first_token' || SEQUENCE.flat().includes(step)) continue;
    const duration = num(value);
    if (duration !== null) {
      raw.push({ step, label: stepLabel(step), start: cursor, duration, marker: false });
      cursor += duration;
    }
  }
  const declaredTotal = num(t['total']);
  const total = Math.max(declaredTotal ?? 0, cursor, ...raw.map((b) => b.start + b.duration), 1);
  if (declaredTotal !== null) raw.push({ step: 'total', label: stepLabel('total'), start: 0, duration: declaredTotal, marker: true });
  return {
    total,
    bars: raw.map((bar) => ({
      ...bar,
      offsetPct: (bar.start / total) * 100,
      widthPct: Math.max((bar.duration / total) * 100, 0.4),
    })),
  };
}
