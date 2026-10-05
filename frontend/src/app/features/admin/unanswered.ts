import { httpResource } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { RouterLink } from '@angular/router';
import { UnansweredCluster } from '../../core/api/models';
import { injectApiV1 } from '../../core/http/api-url';
import { RelativeTimePipe } from '../../shared/pipes/relative-time.pipe';
import { EmptyState } from '../../shared/ui/empty-state';

@Component({
  selector: 'kb-admin-unanswered',
  imports: [MatExpansionModule, MatButtonModule, MatIconModule, MatProgressBarModule, RouterLink, RelativeTimePipe, EmptyState],
  template: `
    <div class="kb-page">
      <header class="kb-page-header">
        <h1 i18n="@@admin.unanswered.title">Unanswered questions</h1>
        <span class="kb-spacer"></span>
        <button mat-stroked-button type="button" (click)="refresh()">
          <mat-icon>refresh</mat-icon>
          <span i18n="@@admin.unanswered.recluster">Re-cluster</span>
        </button>
      </header>
      <p class="kb-muted" i18n="@@admin.unanswered.intro">Questions the assistant could not answer, grouped by meaning. Each cluster is a hint for a missing document.</p>
      @if (clusters.isLoading()) {
        <mat-progress-bar mode="indeterminate" />
      }
      <mat-accordion multi data-testid="unanswered-clusters">
        @for (cluster of clusters.value() ?? []; track cluster.id) {
          <mat-expansion-panel data-testid="unanswered-cluster">
            <mat-expansion-panel-header>
              <mat-panel-title>
                @if (cluster.label) {
                  {{ cluster.label }}
                } @else {
                  <span i18n="@@admin.unanswered.unlabelled">Unlabelled cluster</span>
                }
              </mat-panel-title>
              <mat-panel-description>
                <span><strong>{{ cluster.count }}</strong>&nbsp;<span i18n="@@admin.unanswered.questionNoun">{cluster.count, plural, one {question} other {questions}}</span> · <span i18n="@@admin.unanswered.userCount">{cluster.users, plural, one {{{ cluster.users }} user} other {{{ cluster.users }} users}}</span> · <span i18n="@@admin.unanswered.lastSeen">last {{ cluster.last_seen | relativeTime }}</span></span>
              </mat-panel-description>
            </mat-expansion-panel-header>
            <ul class="questions">
              @for (q of cluster.questions; track q.query_log_id) {
                <li>
                  <a [routerLink]="['/admin/query-logs', q.query_log_id]">{{ q.question }}</a>
                  <span class="kb-muted"> · {{ q.created_at | relativeTime }}</span>
                </li>
              }
            </ul>
          </mat-expansion-panel>
        } @empty {
          @if (!clusters.isLoading()) {
            <kb-empty-state icon="task_alt" title="Nothing unanswered" i18n-title="@@admin.unanswered.emptyTitle" message="Every question in the period found an answer." i18n-message="@@admin.unanswered.emptyMessage" />
          }
        }
      </mat-accordion>
    </div>
  `,
  styles: `
    .kb-spacer {
      flex: 1;
    }
    .questions {
      display: grid;
      gap: 6px;
      margin: 0;
      padding-left: 18px;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UnansweredPage {
  private readonly api = injectApiV1();
  private readonly fresh = signal(false);
  protected readonly clusters = httpResource<UnansweredCluster[]>(() => ({
    url: this.api('/admin/analytics/unanswered'),
    params: { fresh: this.fresh() },
  }));

  protected refresh(): void {
    if (this.fresh()) this.clusters.reload();
    else this.fresh.set(true);
  }
}
