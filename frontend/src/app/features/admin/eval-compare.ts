import { httpResource } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { RouterLink } from '@angular/router';
import { CompareOut, CompareRow } from '../../core/api/models';
import { injectApiV1 } from '../../core/http/api-url';
import { EmptyState } from '../../shared/ui/empty-state';
import { changeLabel } from './labels';
import { configSummary, deltaTone, formatDelta, formatMetric, HEADLINE_METRICS, metricDef, metricValue } from './metrics';

export type ChangeFilter = '' | CompareRow['change'];

export function filterCompareRows(rows: CompareRow[], type: string, change: ChangeFilter): CompareRow[] {
  return rows.filter((row) => (!type || (row.question_type ?? 'other') === type) && (!change || row.change === change));
}

@Component({
  selector: 'kb-admin-eval-compare',
  imports: [RouterLink, MatButtonModule, MatButtonToggleModule, MatIconModule, MatProgressBarModule, MatSelectModule, EmptyState],
  templateUrl: './eval-compare.html',
  styleUrl: './eval-compare.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EvalComparePage {
  private readonly api = injectApiV1();
  readonly a = input<string | undefined>(undefined);
  readonly b = input<string | undefined>(undefined);

  protected readonly compare = httpResource<CompareOut>(() => {
    const a = this.a();
    const b = this.b();
    return a && b ? { url: this.api('/admin/eval/compare'), params: { a, b } } : undefined;
  });
  protected readonly typeFilter = signal('');
  protected readonly changeFilter = signal<ChangeFilter>('');
  protected readonly expanded = signal<string | null>(null);
  protected readonly headline = HEADLINE_METRICS.map(metricDef);
  protected readonly types = computed(() => [...new Set((this.compare.value()?.rows ?? []).map((r) => r.question_type ?? 'other'))].sort());
  protected readonly rows = computed(() => filterCompareRows(this.compare.value()?.rows ?? [], this.typeFilter(), this.changeFilter()));
  protected readonly counts = computed(() => {
    const summary = this.compare.value()?.summary ?? {};
    return {
      improved: summary['improved'] ?? 0,
      worse: summary['worse'] ?? 0,
      unchanged: summary['unchanged'] ?? 0,
      added: summary['new'] ?? 0,
      removed: summary['removed'] ?? 0,
    };
  });
  protected readonly changeLabel = changeLabel;
  protected readonly summary = configSummary;
  protected readonly fmt = formatMetric;
  protected readonly fmtDelta = formatDelta;
  protected readonly tone = deltaTone;
  protected readonly value = metricValue;

  protected rowMetric(metrics: Record<string, unknown> | null, key: string): string {
    return formatMetric(metricValue(metrics, key));
  }

  protected docs(metrics: Record<string, unknown> | null): string[] {
    const docs = metrics?.['retrieved_docs'];
    return Array.isArray(docs) ? docs.map(String) : [];
  }

  protected toggle(row: CompareRow): void {
    this.expanded.update((id) => (id === row.question_id ? null : row.question_id));
  }
}
