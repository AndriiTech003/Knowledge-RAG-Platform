import { Observable } from 'rxjs';
import { AppError, codeForStatus, defaultTitle, fromProblem } from '../http/app-error';
import { isProblemDetails } from '../http/problem-details';
import { decodeSseData, SseEvent, SseParser } from './sse-parser';

export interface SseRequestInit {
  method?: 'GET' | 'POST';
  headers?: Record<string, string>;
  fetchFn?: typeof fetch;
}

export async function errorFromResponse(response: Response): Promise<AppError> {
  const correlationId = response.headers.get('x-correlation-id');
  const body = await response
    .text()
    .then((text) => (text ? (JSON.parse(text) as unknown) : null))
    .catch(() => null);
  if (isProblemDetails(body)) return fromProblem(body, response.status, correlationId);
  return new AppError(codeForStatus(response.status), defaultTitle(response.status), response.status, null, correlationId);
}

export function sseStream<T>(url: string, body?: unknown, init: SseRequestInit = {}): Observable<SseEvent<T>> {
  return new Observable<SseEvent<T>>((subscriber) => {
    const controller = new AbortController();
    const fetchFn = init.fetchFn ?? fetch;
    const method = init.method ?? (body === undefined ? 'GET' : 'POST');
    const headers: Record<string, string> = { Accept: 'text/event-stream', ...(init.headers ?? {}) };
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    let finished = false;

    const run = async () => {
      const response = await fetchFn(url, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: controller.signal,
        cache: 'no-store',
      });
      if (!response.ok) throw await errorFromResponse(response);
      if (!response.body) throw new AppError('INTERNAL', $localize`:@@error.noStreaming:Streaming is not supported by this browser`);
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      const parser = new SseParser();
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        for (const raw of parser.feed(decoder.decode(value, { stream: true }))) {
          if (subscriber.closed) return;
          subscriber.next(decodeSseData<T>(raw));
        }
      }
      for (const raw of parser.feed(decoder.decode())) subscriber.next(decodeSseData<T>(raw));
      for (const raw of parser.flush()) subscriber.next(decodeSseData<T>(raw));
    };

    run()
      .then(() => {
        finished = true;
        subscriber.complete();
      })
      .catch((error: unknown) => {
        finished = true;
        if (controller.signal.aborted) return;
        subscriber.error(AppError.from(error));
      });

    return () => {
      if (!finished) controller.abort();
    };
  });
}
