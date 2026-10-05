import { HttpInterceptorFn } from '@angular/common/http';
import { injectIsApiRequest } from './api-url';

export const CORRELATION_HEADER = 'X-Correlation-Id';

export function newCorrelationId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return `${Date.now().toString(16)}-${Math.random().toString(16).slice(2)}`;
}

export const correlationIdInterceptor: HttpInterceptorFn = (req, next) => {
  const isApi = injectIsApiRequest();
  if (!isApi(req.url) || req.headers.has(CORRELATION_HEADER)) return next(req);
  return next(req.clone({ setHeaders: { [CORRELATION_HEADER]: newCorrelationId() } }));
};
