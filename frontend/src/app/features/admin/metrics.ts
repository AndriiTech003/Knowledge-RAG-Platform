import { activeLocale } from '../../core/i18n/locale';
import { formatNumber } from '../../core/i18n/plural';

export interface MetricDef {
  key: string;
  label: string;
  higherIsBetter: boolean;
  kind: 'ratio' | 'ms' | 'usd' | 'count';
}

export function evalMetrics(): MetricDef[] {
  return [
    { key: 'recall@5', label: $localize`:@@admin.metric.recall5:Recall@5`, higherIsBetter: true, kind: 'ratio' },
    { key: 'recall@8', label: $localize`:@@admin.metric.recall8:Recall@8`, higherIsBetter: true, kind: 'ratio' },
    { key: 'mrr', label: 'MRR', higherIsBetter: true, kind: 'ratio' },
    { key: 'ndcg@8', label: 'nDCG@8', higherIsBetter: true, kind: 'ratio' },
    { key: 'leakage_rate', label: $localize`:@@admin.metric.leakage:Leakage`, higherIsBetter: false, kind: 'ratio' },
    { key: 'no_answer_accuracy', label: $localize`:@@admin.metric.noAnswerAccuracy:No-answer acc.`, higherIsBetter: true, kind: 'ratio' },
    { key: 'correctness', label: $localize`:@@admin.metric.correctness:Correctness`, higherIsBetter: true, kind: 'ratio' },
    { key: 'faithfulness', label: $localize`:@@admin.metric.faithfulness:Faithfulness`, higherIsBetter: true, kind: 'ratio' },
    { key: 'citation_precision', label: $localize`:@@admin.metric.citationPrecision:Citation precision`, higherIsBetter: true, kind: 'ratio' },
    { key: 'p50_latency_ms', label: $localize`:@@admin.metric.p50Latency:p50 latency`, higherIsBetter: false, kind: 'ms' },
    { key: 'p95_latency_ms', label: $localize`:@@admin.metric.p95Latency:p95 latency`, higherIsBetter: false, kind: 'ms' },
  ];
}

export const HEADLINE_METRICS = ['recall@8', 'mrr', 'ndcg@8', 'leakage_rate', 'no_answer_accuracy', 'faithfulness'];

export function metricDef(key: string): MetricDef {
  return evalMetrics().find((m) => m.key === key) ?? { key, label: key, higherIsBetter: true, kind: 'ratio' };
}

export function metricValue(metrics: Record<string, unknown> | null | undefined, key: string): number | null {
  const value = metrics?.[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function fixed(value: number, digits: number): string {
  return formatNumber(value, activeLocale(), { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

function whole(value: number): string {
  return formatNumber(Math.round(value), activeLocale(), { maximumFractionDigits: 0, useGrouping: false });
}

export function formatMetric(value: number | null | undefined, kind: MetricDef['kind'] = 'ratio'): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  switch (kind) {
    case 'ms':
      return `${whole(value)} ms`;
    case 'usd':
      return formatNumber(value, activeLocale(), { style: 'currency', currency: 'USD', minimumFractionDigits: 4, maximumFractionDigits: 4 });
    case 'count':
      return whole(value);
    default:
      return fixed(value, 3);
  }
}

export function formatDelta(delta: number | null | undefined, kind: MetricDef['kind'] = 'ratio'): string {
  if (delta === null || delta === undefined || !Number.isFinite(delta) || delta === 0) return '±0';
  const sign = delta > 0 ? '+' : '−';
  const abs = Math.abs(delta);
  return kind === 'ms' ? `${sign}${whole(abs)} ms` : `${sign}${fixed(abs, 3)}`;
}

export type DeltaTone = 'up' | 'down' | 'flat';

export function deltaTone(delta: number | null | undefined, higherIsBetter: boolean): DeltaTone {
  if (delta === null || delta === undefined || Math.abs(delta) < 1e-9) return 'flat';
  const good = higherIsBetter ? delta > 0 : delta < 0;
  return good ? 'up' : 'down';
}

function runModeLabel(mode: string): string {
  switch (mode) {
    case 'retrieval':
      return $localize`:@@admin.config.mode.retrieval:retrieval`;
    case 'full':
      return $localize`:@@admin.config.mode.full:full`;
    default:
      return mode;
  }
}

function retrievalModeLabel(mode: string): string {
  switch (mode) {
    case 'vector':
      return $localize`:@@admin.config.retrieval.vector:vector`;
    case 'lexical':
      return $localize`:@@admin.config.retrieval.lexical:lexical`;
    case 'hybrid':
      return $localize`:@@admin.config.retrieval.hybrid:hybrid`;
    default:
      return mode;
  }
}

export function configSummary(config: Record<string, unknown> | null | undefined): string {
  if (!config) return '';
  const retrieval = (config['retrieval'] ?? {}) as Record<string, unknown>;
  const limit = config['limit'] ? String(config['limit']) : '';
  const parts = [
    runModeLabel(String(config['mode'] ?? 'retrieval')),
    retrievalModeLabel(String(retrieval['mode'] ?? '')),
    retrieval['rerank'] ? $localize`:@@admin.config.rerank:rerank` : $localize`:@@admin.config.noRerank:no rerank`,
    retrieval['k'] ? `k=${String(retrieval['k'])}` : '',
    limit ? $localize`:@@admin.config.limit:limit ${limit}:limit:` : '',
  ];
  return parts.filter(Boolean).join(' · ');
}
