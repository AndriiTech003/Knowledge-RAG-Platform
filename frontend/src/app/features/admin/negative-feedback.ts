import { DecimalPipe } from '@angular/common';
import { httpResource } from '@angular/common/http';
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { RouterLink } from '@angular/router';
import { NegativeFeedbackItem } from '../../core/api/models';
import { injectApiV1 } from '../../core/http/api-url';
import { RelativeTimePipe } from '../../shared/pipes/relative-time.pipe';
import { EmptyState } from '../../shared/ui/empty-state';

@Component({
  selector: 'kb-admin-negative-feedback',
  imports: [MatExpansionModule, MatIconModule, MatProgressBarModule, RouterLink, RelativeTimePipe, DecimalPipe, EmptyState],
  template: `
    <div class="kb-page">
      <header class="kb-page-header"><h1 i18n="@@admin.feedback.title">Negative feedback</h1></header>
      @if (items.isLoading()) {
        <mat-progress-bar mode="indeterminate" />
      }
      <mat-accordion multi>
        @for (item of items.value() ?? []; track item.id) {
          <mat-expansion-panel data-testid="feedback-item">
            <mat-expansion-panel-header>
              <mat-panel-title>
                @if (item.question) {
                  {{ item.question }}
                } @else {
                  <span i18n="@@admin.feedback.unknownQuestion">Unknown question</span>
                }
              </mat-panel-title>
              <mat-panel-description>
                @if (item.reason) {
                  <span class="reason">{{ item.reason }}</span>
                } @else {
                  <span class="reason" i18n="@@admin.feedback.noReason">no reason</span>
                }&nbsp;· {{ item.created_at | relativeTime }}
              </mat-panel-description>
            </mat-expansion-panel-header>
            @if (item.comment) {
              <blockquote>{{ item.comment }}</blockquote>
            }
            <h3 i18n="@@admin.feedback.answer">Answer</h3>
            <p class="answer">{{ item.answer || '—' }}</p>
            <h3 i18n="@@admin.feedback.retrievedChunks">Retrieved chunks</h3>
            <ol class="retrieved">
              @for (c of item.retrieved; track c.chunk_id) {
                <li [class.selected]="c.selected">
                  {{ c.title }}@if (c.page) { · <span i18n="@@admin.pageRef">p. {{ c.page }}</span>} · rrf {{ c.rrf | number: '1.4-4' }}@if (c.rerank_score !== null && c.rerank_score !== undefined) { · <span i18n="@@admin.feedback.rerankScore">rerank {{ c.rerank_score | number: '1.3-3' }}</span>}
                  @if (c.selected) { <mat-icon inline aria-label="selected for prompt" i18n-aria-label="@@admin.feedback.selectedForPrompt">check</mat-icon> }
                </li>
              }
            </ol>
            @if (item.query_log_id) {
              <a [routerLink]="['/admin/query-logs', item.query_log_id]" i18n="@@admin.feedback.openTrace">Open full trace →</a>
            }
          </mat-expansion-panel>
        } @empty {
          @if (!items.isLoading()) {
            <kb-empty-state icon="sentiment_satisfied" title="No negative feedback" i18n-title="@@admin.feedback.emptyTitle" />
          }
        }
      </mat-accordion>
    </div>
  `,
  styles: `
    .reason {
      padding: 2px 8px;
      border-radius: 999px;
      background: var(--mat-sys-error-container);
      color: var(--mat-sys-on-error-container);
    }
    blockquote {
      margin: 0 0 8px;
      padding-left: 12px;
      border-left: 3px solid var(--mat-sys-outline);
    }
    h3 {
      margin: 12px 0 4px;
      font: var(--mat-sys-title-small);
    }
    .answer {
      white-space: pre-wrap;
    }
    .retrieved li.selected {
      font-weight: 500;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NegativeFeedbackPage {
  private readonly api = injectApiV1();
  protected readonly items = httpResource<NegativeFeedbackItem[]>(() => ({ url: this.api('/admin/analytics/negative-feedback'), params: { limit: 100 } }));
}
