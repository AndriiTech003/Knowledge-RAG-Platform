import { EvalRunOut } from '../../core/api/models';
import { hasActiveRuns, latestCompletedPair } from './admin.store';
import { filterCompareRows } from './eval-compare';
import { configSummary, deltaTone, formatDelta, formatMetric } from './metrics';
import { buildWaterfall } from './waterfall';

function run(id: string, status: string, started: string): EvalRunOut {
  return { id, status, started_at: started, finished_at: null, config: {}, metrics: null, git_sha: null, dataset_version: null, error: null };
}

describe('waterfall', () => {
  it('lays out pipeline steps sequentially with vector and lexical in parallel', () => {
    const wf = buildWaterfall({ acl: 2, embed: 10, vector: 5, lexical: 8, fetch: 2, rerank: 20, generate: 50, first_token: 60, total: 100 });
    const bar = (step: string) => wf.bars.find((b) => b.step === step)!;
    expect(bar('vector').start).toBe(12);
    expect(bar('lexical').start).toBe(12);
    expect(bar('fetch').start).toBe(20);
    expect(bar('rerank').start).toBe(22);
    expect(bar('first_token').marker).toBe(true);
    expect(wf.total).toBe(100);
    expect(bar('total').widthPct).toBe(100);
  });

  it('handles empty timings', () => {
    expect(buildWaterfall(null).bars).toEqual([]);
  });
});

describe('metrics formatting', () => {
  it('formats values and deltas', () => {
    expect(formatMetric(0.12345)).toBe('0.123');
    expect(formatMetric(1234.4, 'ms')).toBe('1234 ms');
    expect(formatMetric(null)).toBe('—');
    expect(formatDelta(0.05)).toBe('+0.050');
    expect(formatDelta(-0.05)).toBe('−0.050');
    expect(formatDelta(0)).toBe('±0');
  });

  it('colours deltas by whether higher is better', () => {
    expect(deltaTone(0.1, true)).toBe('up');
    expect(deltaTone(0.1, false)).toBe('down');
    expect(deltaTone(0, true)).toBe('flat');
  });

  it('summarises a run configuration', () => {
    expect(configSummary({ mode: 'retrieval', limit: 10, retrieval: { mode: 'hybrid', rerank: true, k: 8 } })).toBe('retrieval · hybrid · rerank · k=8 · limit 10');
  });
});

describe('eval runs helpers', () => {
  it('detects active runs and picks the two latest finished ones', () => {
    const runs = [run('a', 'done', '2026-01-01'), run('b', 'done', '2026-01-03'), run('c', 'running', '2026-01-04'), run('d', 'done', '2026-01-02')];
    expect(hasActiveRuns(runs)).toBe(true);
    expect(latestCompletedPair(runs)?.map((r) => r.id)).toEqual(['d', 'b']);
    expect(latestCompletedPair([run('a', 'done', '2026-01-01')])).toBeNull();
  });

  it('filters compare rows by question type and change', () => {
    const rows = [
      { question_id: '1', question_type: 'factoid', question: null, a: null, b: null, change: 'improved' as const, delta: 0.2 },
      { question_id: '2', question_type: 'multi_hop', question: null, a: null, b: null, change: 'worse' as const, delta: -0.1 },
    ];
    expect(filterCompareRows(rows, 'factoid', '').map((r) => r.question_id)).toEqual(['1']);
    expect(filterCompareRows(rows, '', 'worse').map((r) => r.question_id)).toEqual(['2']);
  });
});
