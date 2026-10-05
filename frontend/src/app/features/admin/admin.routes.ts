import { Routes } from '@angular/router';
import { provideEchartsCore } from 'ngx-echarts';
import { roleGuard } from '../../core/auth/role.guard';
import { AdminStore } from './admin.store';

const routes: Routes = [
  {
    path: '',
    canActivate: [roleGuard('kb-admins')],
    providers: [AdminStore, provideEchartsCore({ echarts: () => import('./echarts-setup') })],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'overview' },
      { path: 'overview', loadComponent: () => import('./overview').then((m) => m.OverviewPage) },
      { path: 'unanswered', loadComponent: () => import('./unanswered').then((m) => m.UnansweredPage) },
      { path: 'feedback', loadComponent: () => import('./negative-feedback').then((m) => m.NegativeFeedbackPage) },
      { path: 'query-logs', loadComponent: () => import('./query-logs').then((m) => m.QueryLogsPage) },
      { path: 'query-logs/:queryLogId', loadComponent: () => import('./query-trace').then((m) => m.QueryTracePage) },
      { path: 'eval', loadComponent: () => import('./eval-runs').then((m) => m.EvalRunsPage) },
      { path: 'eval/compare', loadComponent: () => import('./eval-compare').then((m) => m.EvalComparePage) },
      { path: 'eval/runs/:runId', loadComponent: () => import('./eval-run-detail').then((m) => m.EvalRunDetailPage) },
    ],
  },
];

export default routes;
