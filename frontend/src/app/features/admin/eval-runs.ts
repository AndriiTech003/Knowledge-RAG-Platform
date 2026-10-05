import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Router, RouterLink } from '@angular/router';
import { EvalRunCreate, EvalRunOut } from '../../core/api/models';
import { NotificationService } from '../../core/errors/notification.service';
import { RelativeTimePipe } from '../../shared/pipes/relative-time.pipe';
import { StatusBadge } from '../../shared/ui/status-badge';
import { AdminStore } from './admin.store';
import { configSummary, deltaTone, formatDelta, formatMetric, HEADLINE_METRICS, metricDef, metricValue } from './metrics';

@Component({
  selector: 'kb-admin-eval-runs',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    MatButtonModule,
    MatButtonToggleModule,
    MatCheckboxModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressBarModule,
    MatSelectModule,
    MatSlideToggleModule,
    MatTooltipModule,
    StatusBadge,
    RelativeTimePipe,
  ],
  templateUrl: './eval-runs.html',
  styleUrl: './eval-runs.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EvalRunsPage implements OnInit {
  protected readonly store = inject(AdminStore);
  private readonly router = inject(Router);
  private readonly notify = inject(NotificationService);

  protected readonly headline = HEADLINE_METRICS.map(metricDef);
  protected readonly selected = signal<string[]>([]);
  protected readonly formOpen = signal(false);
  protected readonly canCompare = computed(() => this.selected().length === 2);
  protected readonly form = new FormGroup({
    mode: new FormControl<'retrieval' | 'full'>('retrieval', { nonNullable: true }),
    retrievalMode: new FormControl<'vector' | 'lexical' | 'hybrid'>('hybrid', { nonNullable: true }),
    rerank: new FormControl(true, { nonNullable: true }),
    k: new FormControl(8, { nonNullable: true, validators: [Validators.required, Validators.min(1), Validators.max(50)] }),
    limit: new FormControl<number | null>(null, { validators: [Validators.min(1), Validators.max(1000)] }),
    name: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(80)] }),
  });

  protected readonly summary = configSummary;
  protected readonly fmt = formatMetric;
  protected readonly fmtDelta = formatDelta;
  protected readonly tone = deltaTone;
  protected readonly value = metricValue;

  ngOnInit(): void {
    this.store.loadRuns();
  }

  protected toggle(run: EvalRunOut, checked: boolean): void {
    this.selected.update((ids) => {
      const without = ids.filter((id) => id !== run.id);
      if (!checked) return without;
      return [...without, run.id].slice(-2);
    });
  }

  protected selectLabel(run: EvalRunOut): string {
    const id = run.id;
    return $localize`:@@admin.evalRuns.selectRun:Select run ${id}:id:`;
  }

  protected delta(run: EvalRunOut, key: string): number | null {
    const value = run.deltas?.[key];
    return typeof value === 'number' ? value : null;
  }

  protected async start(): Promise<void> {
    if (this.form.invalid) return;
    const v = this.form.getRawValue();
    const body: EvalRunCreate = {
      mode: v.mode,
      retrieval_mode: v.retrievalMode,
      rerank: v.rerank,
      k: v.k,
      limit: v.limit ?? null,
      name: v.name.trim() || null,
    };
    const run = await this.store.startRun(body);
    if (run) {
      this.notify.info($localize`:@@admin.evalRuns.queued:Evaluation run queued`);
      this.formOpen.set(false);
    } else {
      this.notify.error(this.store.error()?.userMessage ?? $localize`:@@admin.evalRuns.startFailed:Could not start the run`);
    }
  }

  protected compareSelected(): void {
    const [a, b] = this.selected();
    if (a && b) void this.router.navigate(['/admin/eval/compare'], { queryParams: { a, b } });
  }

  protected compareLatest(): void {
    const pair = this.store.latestPair();
    if (pair) void this.router.navigate(['/admin/eval/compare'], { queryParams: { a: pair[0].id, b: pair[1].id } });
  }
}
