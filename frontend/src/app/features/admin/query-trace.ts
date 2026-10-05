import { CurrencyPipe, DatePipe, DecimalPipe, formatNumber } from '@angular/common';
import { httpResource } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, LOCALE_ID, computed, inject, input } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { RouterLink } from '@angular/router';
import { QueryTrace } from '../../core/api/models';
import { injectApiV1 } from '../../core/http/api-url';
import { outcomeLabel } from './labels';
import { WaterfallBar, buildWaterfall } from './waterfall';

@Component({
  selector: 'kb-admin-query-trace',
  imports: [MatTableModule, MatExpansionModule, MatIconModule, MatButtonModule, MatProgressBarModule, MatTooltipModule, RouterLink, DecimalPipe, CurrencyPipe, DatePipe],
  templateUrl: './query-trace.html',
  styleUrl: './query-trace.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class QueryTracePage {
  private readonly api = injectApiV1();
  private readonly locale = inject(LOCALE_ID);
  readonly queryLogId = input.required<string>();
  protected readonly trace = httpResource<QueryTrace>(() => this.api(`/admin/query-logs/${this.queryLogId()}`));
  protected readonly waterfall = computed(() => buildWaterfall(this.trace.value()?.timings_ms));
  protected readonly columns = ['selected', 'title', 'page', 'vector_rank', 'vector_score', 'lexical_rank', 'lexical_score', 'rrf', 'rerank_score'];
  protected readonly allowedNames = computed(() => (this.trace.value()?.allowed_collections ?? []).map((c) => c.name).join(', '));
  protected readonly citations = computed(() =>
    (this.trace.value()?.citations ?? []).map((c) => c as { n?: number; title?: string; page?: number | null }),
  );
  protected readonly promptLength = computed(() => this.trace.value()?.prompt?.length ?? 0);
  protected readonly outcomeLabel = outcomeLabel;

  protected barTooltip(bar: WaterfallBar): string {
    const label = bar.label;
    const duration = formatNumber(bar.duration, this.locale, '1.0-1');
    const start = formatNumber(bar.start, this.locale, '1.0-0');
    return $localize`:@@admin.trace.barTooltip:${label}:step:: ${duration}:duration: ms (starts at ${start}:start: ms)`;
  }
}
