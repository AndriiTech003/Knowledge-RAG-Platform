import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { retry, throwError, timer } from 'rxjs';

export const RETRYABLE_STATUSES = new Set([0, 502, 503, 504]);

export interface RetryPolicy {
  count: number;
  baseDelayMs: number;
}

export const DEFAULT_RETRY_POLICY: RetryPolicy = { count: 2, baseDelayMs: 300 };

export function isRetryable(error: unknown): boolean {
  return error instanceof HttpErrorResponse && RETRYABLE_STATUSES.has(error.status);
}

export function retryInterceptorWith(policy: RetryPolicy): HttpInterceptorFn {
  return (req, next) => {
    if (req.method !== 'GET' || req.headers.get('Accept') === 'text/event-stream') return next(req);
    return next(req).pipe(
      retry({
        count: policy.count,
        delay: (error: unknown, attempt: number) =>
          isRetryable(error) ? timer(policy.baseDelayMs * 2 ** (attempt - 1)) : throwError(() => error),
      }),
    );
  };
}

export const retryInterceptor: HttpInterceptorFn = retryInterceptorWith(DEFAULT_RETRY_POLICY);
