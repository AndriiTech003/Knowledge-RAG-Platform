import { DatePipe } from '@angular/common';
import { httpResource } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, effect, input, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { RouterLink } from '@angular/router';
import { EvalResultOut, EvalRunDetail } from '../../core/api/models';
import { injectApiV1 } from '../../core/http/api-url';
import { StatusBadge } from '../../shared/ui/status-badge';
import { ACTIVE_RUN_STATUSES, POLL_INTERVAL_MS } from './admin.store';
import { configSummary, evalMetrics, formatMetric, metricDef, metricValue } from './metrics';

@Component({
  selector: 'kb-admin-eval-run-detail',
  imports: [RouterLink, DatePipe, MatButtonModule, MatExpansionModule, MatIconModule, MatProgressBarModule, MatSelectModule, StatusBadge],
  templateUrl: './eval-run-detail.html',
  styleUrl: './eval-run-detail.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EvalRunDetailPage {
  private readonly api = injectApiV1();
  readonly runId = input.required<string>();
  protected readonly run = httpResource<EvalRunDetail>(() => this.api(`/admin/eval/runs/${this.runId()}`));
  protected readonly typeFilter = signal('');
  protected readonly metrics = computed(() => {
    const m = this.run.value()?.metrics ?? null;
    return evalMetrics().filter((def) => metricValue(m, def.key) !== null).map((def) => ({ def, value: metricValue(m, def.key) }));
  });
  protected readonly byType = computed(() => {
    const raw = (this.run.value()?.metrics?.['by_type'] ?? {}) as Record<string, Record<string, unknown>>;
    return Object.entries(raw).map(([type, values]) => ({ type, values }));
  });
  protected readonly types = computed(() => [...new Set((this.run.value()?.results ?? []).map((r) => r.question_type ?? 'other'))].sort());
  protected readonly results = computed(() => {
    const filter = this.typeFilter();
    return (this.run.value()?.results ?? []).filter((r) => !filter || (r.question_type ?? 'other') === filter);
  });
  protected readonly summary = configSummary;
  protected readonly fmt = formatMetric;
  protected readonly value = metricValue;
  protected readonly typeColumns = ['questions', 'recall@8', 'mrr', 'ndcg@8', 'leakage_rate', 'no_answer_accuracy', 'faithfulness'];

  constructor() {
    effect((onCleanup) => {
      const status = this.run.value()?.status;
      if (!status || !ACTIVE_RUN_STATUSES.has(status)) return;
      const handle = setTimeout(() => this.run.reload(), POLL_INTERVAL_MS);
      onCleanup(() => clearTimeout(handle));
    });
  }

  protected columnLabel(column: string): string {
    return column === 'questions' ? $localize`:@@admin.runDetail.col.questions:Questions` : metricDef(column).label;
  }

  protected retrievedDocs(result: EvalResultOut): string[] {
    const docs = result.metrics?.['retrieved_docs'];
    return Array.isArray(docs) ? docs.map(String) : result.retrieved_doc_ids;
  }

  protected scalarMetrics(result: EvalResultOut): { key: string; value: string }[] {
    return Object.entries(result.metrics ?? {})
      .filter(([, v]) => typeof v === 'number' || typeof v === 'boolean' || typeof v === 'string')
      .map(([key, v]) => ({ key, value: typeof v === 'number' ? (Number.isInteger(v) ? String(v) : formatMetric(v)) : String(v) }));
  }
}
