import { CurrencyPipe, DecimalPipe, PercentPipe } from '@angular/common';
import { httpResource } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { NgxEchartsDirective } from 'ngx-echarts';
import { Overview } from '../../core/api/models';
import { injectApiV1 } from '../../core/http/api-url';
import { Skeleton } from '../../shared/ui/skeleton';
import { latencyCostChart, questionsChart, rangeFor, stepsChart } from './overview-charts';

@Component({
  selector: 'kb-admin-overview',
  imports: [NgxEchartsDirective, MatButtonToggleModule, MatIconModule, MatProgressBarModule, DecimalPipe, PercentPipe, CurrencyPipe, Skeleton],
  templateUrl: './overview.html',
  styleUrl: './admin-common.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OverviewPage {
  private readonly api = injectApiV1();
  protected readonly days = signal(30);
  protected readonly overview = httpResource<Overview>(() => ({ url: this.api('/admin/analytics/overview'), params: rangeFor(this.days()) }));
  protected readonly questionsOptions = computed(() => questionsChart(this.overview.value()?.daily ?? []));
  protected readonly latencyOptions = computed(() => latencyCostChart(this.overview.value()?.daily ?? []));
  protected readonly stepsOptions = computed(() => stepsChart(this.overview.value()?.steps_ms ?? {}));
}
