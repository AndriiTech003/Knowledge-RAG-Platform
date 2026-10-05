import { Injectable, inject } from '@angular/core';
import { Observable, switchMap, take } from 'rxjs';
import { AccessTokenProvider } from '../auth/access-token';
import { apiV1, RUNTIME_CONFIG } from '../config/runtime-config';
import { CORRELATION_HEADER, newCorrelationId } from '../http/correlation-id.interceptor';
import { SseEvent } from './sse-parser';
import { sseStream } from './sse-stream';

@Injectable({ providedIn: 'root' })
export class SseClient {
  private readonly config = inject(RUNTIME_CONFIG);
  private readonly tokens = inject(AccessTokenProvider);

  stream<T>(path: string, body?: unknown): Observable<SseEvent<T>> {
    return this.tokens.token$().pipe(
      take(1),
      switchMap((token) => {
        const headers: Record<string, string> = { [CORRELATION_HEADER]: newCorrelationId() };
        if (token) headers['Authorization'] = `Bearer ${token}`;
        return sseStream<T>(apiV1(this.config, path), body, { headers });
      }),
    );
  }
}
