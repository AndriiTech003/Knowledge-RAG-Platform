import { HttpErrorResponse } from '@angular/common/http';
import { DEFAULT_LOCALE, activeLocale } from '../i18n/locale';
import { isProblemDetails, ProblemDetails, ProblemFieldError } from './problem-details';

export type AppErrorCode =
  | 'NETWORK'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'VALIDATION'
  | 'RATE_LIMITED'
  | 'DAILY_TOKEN_LIMIT'
  | 'LLM_UNAVAILABLE'
  | 'INTERNAL'
  | 'ABORTED'
  | (string & {});

export class AppError extends Error {
  override readonly name = 'AppError';

  constructor(
    readonly code: AppErrorCode,
    message: string,
    readonly status: number = 0,
    readonly detail: string | null = null,
    readonly correlationId: string | null = null,
    readonly fieldErrors: ProblemFieldError[] = [],
  ) {
    super(message);
  }

  get userMessage(): string {
    return this.detail && this.detail !== this.message ? `${this.message}: ${this.detail}` : this.message;
  }

  static from(error: unknown): AppError {
    if (error instanceof AppError) return error;
    if (error instanceof HttpErrorResponse) return fromHttpError(error);
    if (error instanceof DOMException && error.name === 'AbortError') return new AppError('ABORTED', $localize`:@@error.aborted:Request aborted`);
    if (error instanceof Error) return new AppError('INTERNAL', error.message || $localize`:@@error.unexpected:Unexpected error`);
    return new AppError('INTERNAL', $localize`:@@error.unexpected:Unexpected error`);
  }
}

export function codeForStatus(status: number): AppErrorCode {
  if (status === 0) return 'NETWORK';
  if (status === 401) return 'UNAUTHORIZED';
  if (status === 403) return 'FORBIDDEN';
  if (status === 404) return 'NOT_FOUND';
  if (status === 409 || status === 422 || status === 400) return 'VALIDATION';
  if (status === 429) return 'RATE_LIMITED';
  return 'INTERNAL';
}

export function fromProblem(problem: ProblemDetails, status: number, correlationId: string | null = null): AppError {
  const resolvedStatus = problem.status ?? status;
  const code = problem.code ?? codeForStatus(resolvedStatus);
  const serverTitle = activeLocale() === DEFAULT_LOCALE ? problem.title : (knownTitle(code) ?? problem.title);
  return new AppError(
    code,
    serverTitle ?? defaultTitle(resolvedStatus),
    resolvedStatus,
    problem.detail ?? null,
    problem.correlation_id ?? correlationId,
    problem.errors ?? [],
  );
}

function parseBody(body: unknown): unknown {
  if (typeof body !== 'string') return body;
  try {
    return JSON.parse(body);
  } catch {
    return null;
  }
}

export function fromHttpError(error: HttpErrorResponse): AppError {
  const correlationId = error.headers?.get('x-correlation-id') ?? null;
  const body = parseBody(error.error);
  if (isProblemDetails(body)) return fromProblem(body, error.status, correlationId);
  if (body && typeof body === 'object' && Array.isArray((body as { detail?: unknown }).detail)) {
    const detail = (body as { detail: ProblemFieldError[] }).detail;
    return new AppError('VALIDATION', $localize`:@@error.validation:Validation failed`, error.status, detail.map((d) => d.msg).join('; '), correlationId, detail);
  }
  if (error.status === 0) return new AppError('NETWORK', $localize`:@@error.unreachable:Network error: the server is unreachable`, 0, null, correlationId);
  return new AppError(codeForStatus(error.status), defaultTitle(error.status), error.status, error.message, correlationId);
}

export function defaultTitle(status: number): string {
  switch (status) {
    case 0:
      return $localize`:@@error.network:Network error`;
    case 401:
      return $localize`:@@error.sessionExpired:Your session has expired`;
    case 403:
      return $localize`:@@error.forbidden:You do not have access to this resource`;
    case 404:
      return $localize`:@@error.notFound:Not found`;
    case 422:
      return $localize`:@@error.validation:Validation failed`;
    case 429:
      return $localize`:@@error.tooManyRequests:Too many requests`;
    default:
      return status >= 500 ? $localize`:@@error.server:Server error` : $localize`:@@error.requestFailed:Request failed`;
  }
}

export function knownTitle(code: AppErrorCode): string | null {
  switch (code) {
    case 'NOT_FOUND':
      return $localize`:@@error.notFound:Not found`;
    case 'FORBIDDEN':
    case 'COLLECTION_FORBIDDEN':
      return $localize`:@@error.forbidden:You do not have access to this resource`;
    case 'UNAUTHORIZED':
      return $localize`:@@error.sessionExpired:Your session has expired`;
    case 'VALIDATION':
    case 'VALIDATION_FAILED':
      return $localize`:@@error.validation:Validation failed`;
    case 'RATE_LIMITED':
      return $localize`:@@error.tooManyRequests:Too many requests`;
    case 'DAILY_TOKEN_LIMIT':
      return $localize`:@@error.dailyLimit:Daily token budget exceeded`;
    case 'LLM_UNAVAILABLE':
      return $localize`:@@error.llmUnavailable:The answer model is unavailable`;
    case 'INTERNAL':
      return $localize`:@@error.server:Server error`;
    default:
      return null;
  }
}
