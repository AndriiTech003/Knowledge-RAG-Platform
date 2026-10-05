import { CurrencyPipe, DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, inject } from '@angular/core';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTableModule } from '@angular/material/table';
import { Router, RouterLink } from '@angular/router';
import { QueryLogSummary } from '../../core/api/models';
import { RelativeTimePipe } from '../../shared/pipes/relative-time.pipe';
import { AdminStore } from './admin.store';
import { outcomeLabel } from './labels';

@Component({
  selector: 'kb-admin-query-logs',
  imports: [MatTableModule, MatButtonToggleModule, MatProgressBarModule, RouterLink, RelativeTimePipe, DecimalPipe, CurrencyPipe],
  template: `
    <div class="kb-page">
      <header class="kb-page-header">
        <h1 i18n="@@admin.logs.title">Query traces</h1>
        <span class="kb-spacer"></span>
        <mat-button-toggle-group [value]="store.logsOutcome()" (change)="store.loadLogs($event.value)" aria-label="Outcome filter" i18n-aria-label="@@admin.logs.outcomeFilter">
          <mat-button-toggle value="" i18n="@@admin.logs.filter.all">All</mat-button-toggle>
          <mat-button-toggle value="answered" i18n="@@admin.logs.filter.answered">Answered</mat-button-toggle>
          <mat-button-toggle value="no_answer" i18n="@@admin.logs.filter.noAnswer">No answer</mat-button-toggle>
          <mat-button-toggle value="error" i18n="@@admin.logs.filter.error">Error</mat-button-toggle>
        </mat-button-toggle-group>
      </header>
      @if (store.logsLoading()) {
        <mat-progress-bar mode="indeterminate" />
      }
      <div class="kb-table-wrap">
        <table mat-table [dataSource]="store.logs()" data-testid="query-logs">
          <ng-container matColumnDef="question">
            <th mat-header-cell *matHeaderCellDef i18n="@@admin.logs.col.question">Question</th>
            <td mat-cell *matCellDef="let log"><a [routerLink]="[log.id]">{{ log.question }}</a></td>
          </ng-container>
          <ng-container matColumnDef="outcome">
            <th mat-header-cell *matHeaderCellDef i18n="@@admin.logs.col.outcome">Outcome</th>
            <td mat-cell *matCellDef="let log"><span class="outcome" [class]="'outcome outcome--' + log.outcome">{{ outcomeLabel(log.outcome) }}</span></td>
          </ng-container>
          <ng-container matColumnDef="total">
            <th mat-header-cell *matHeaderCellDef class="kb-num" i18n="@@admin.logs.col.total">Total</th>
            <td mat-cell *matCellDef="let log" class="kb-num">{{ log.timings_ms['total'] ?? 0 | number: '1.0-0' }} ms</td>
          </ng-container>
          <ng-container matColumnDef="cost">
            <th mat-header-cell *matHeaderCellDef class="kb-num" i18n="@@admin.logs.col.cost">Cost</th>
            <td mat-cell *matCellDef="let log" class="kb-num">{{ log.cost_usd | currency: 'USD' : 'symbol' : '1.4-6' }}</td>
          </ng-container>
          <ng-container matColumnDef="created">
            <th mat-header-cell *matHeaderCellDef i18n="@@admin.logs.col.when">When</th>
            <td mat-cell *matCellDef="let log">{{ log.created_at | relativeTime }}</td>
          </ng-container>
          <tr mat-header-row *matHeaderRowDef="columns"></tr>
          <tr mat-row *matRowDef="let row; columns: columns" class="row-link" (click)="open(row)"></tr>
        </table>
      </div>
    </div>
  `,
  styleUrl: './admin-common.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class QueryLogsPage implements OnInit {
  protected readonly store = inject(AdminStore);
  private readonly router = inject(Router);
  protected readonly columns = ['question', 'outcome', 'total', 'cost', 'created'];
  protected readonly outcomeLabel = outcomeLabel;

  ngOnInit(): void {
    this.store.loadLogs(this.store.logsOutcome());
  }

  protected open(log: QueryLogSummary): void {
    void this.router.navigate(['/admin/query-logs', log.id]);
  }
}
