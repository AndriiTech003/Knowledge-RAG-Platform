import { computed, inject } from '@angular/core';
import { patchState, signalStore, withComputed, withMethods, withState } from '@ngrx/signals';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import { EMPTY, catchError, exhaustMap, firstValueFrom, pipe, switchMap, takeWhile, tap, timer } from 'rxjs';
import { EvalRunCreate, EvalRunOut, QueryLogSummary } from '../../core/api/models';
import { AdminService, EvalService } from '../../core/api/services';
import { AppError } from '../../core/http/app-error';

export const ACTIVE_RUN_STATUSES = new Set(['queued', 'running']);
export const POLL_INTERVAL_MS = 2500;

export interface AdminState {
  runs: EvalRunOut[];
  runsLoading: boolean;
  starting: boolean;
  logs: QueryLogSummary[];
  logsLoading: boolean;
  logsOutcome: string;
  error: AppError | null;
}

export const initialAdminState: AdminState = {
  runs: [],
  runsLoading: false,
  starting: false,
  logs: [],
  logsLoading: false,
  logsOutcome: '',
  error: null,
};

export function hasActiveRuns(runs: EvalRunOut[]): boolean {
  return runs.some((run) => ACTIVE_RUN_STATUSES.has(run.status));
}

export function latestCompletedPair(runs: EvalRunOut[]): [EvalRunOut, EvalRunOut] | null {
  const done = runs
    .filter((run) => run.status === 'done')
    .sort((a, b) => new Date(b.started_at ?? 0).getTime() - new Date(a.started_at ?? 0).getTime());
  return done.length >= 2 ? [done[1], done[0]] : null;
}

export const AdminStore = signalStore(
  withState<AdminState>(initialAdminState),
  withComputed(({ runs }) => ({
    activeRuns: computed(() => runs().filter((run) => ACTIVE_RUN_STATUSES.has(run.status))),
    latestPair: computed(() => latestCompletedPair(runs())),
  })),
  withMethods((store, evalApi = inject(EvalService), adminApi = inject(AdminService)) => {
    const fail = (error: unknown) => patchState(store, { error: AppError.from(error) });

    const pollRuns = rxMethod<void>(
      pipe(
        exhaustMap(() =>
          timer(0, POLL_INTERVAL_MS).pipe(
            switchMap(() => evalApi.listEvalRuns({ limit: 50 }).pipe(catchError(() => EMPTY))),
            tap((runs) => patchState(store, { runs, runsLoading: false })),
            takeWhile((runs) => hasActiveRuns(runs), false),
          ),
        ),
      ),
    );

    const loadRuns = rxMethod<void>(
      pipe(
        tap(() => patchState(store, { runsLoading: true })),
        switchMap(() =>
          evalApi.listEvalRuns({ limit: 50 }).pipe(
            tap((runs) => {
              patchState(store, { runs, runsLoading: false });
              if (hasActiveRuns(runs)) pollRuns();
            }),
            catchError((error: unknown) => {
              patchState(store, { runsLoading: false });
              fail(error);
              return EMPTY;
            }),
          ),
        ),
      ),
    );

    const loadLogs = rxMethod<string>(
      pipe(
        tap((outcome) => patchState(store, { logsOutcome: outcome, logsLoading: true })),
        switchMap((outcome) =>
          adminApi.listQueryLogs({ outcome: outcome || null, limit: 100 }).pipe(
            tap((logs) => patchState(store, { logs, logsLoading: false })),
            catchError((error: unknown) => {
              patchState(store, { logsLoading: false });
              fail(error);
              return EMPTY;
            }),
          ),
        ),
      ),
    );

    return {
      loadRuns,
      pollRuns,
      loadLogs,
      async startRun(config: EvalRunCreate): Promise<EvalRunOut | null> {
        patchState(store, { starting: true, error: null });
        try {
          const run = await firstValueFrom(evalApi.startEvalRun({ body: config }));
          patchState(store, (state) => ({ runs: [run, ...state.runs.filter((r) => r.id !== run.id)], starting: false }));
          pollRuns();
          return run;
        } catch (error) {
          patchState(store, { starting: false });
          fail(error);
          return null;
        }
      },
      clearError(): void {
        patchState(store, { error: null });
      },
    };
  }),
);

export type AdminStoreInstance = InstanceType<typeof AdminStore>;
