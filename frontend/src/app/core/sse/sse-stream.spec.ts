import { firstValueFrom, toArray } from 'rxjs';
import { AppError } from '../http/app-error';
import { sseStream } from './sse-stream';
import { sseBody, streamResponse } from '../../../testing/test-helpers';

describe('sseStream', () => {
  it('posts JSON with auth headers and emits decoded events', async () => {
    const fetchFn = vi.fn(async () => streamResponse([sseBody([{ event: 'token', data: { t: 'Hel' } }]).slice(0, 10), sseBody([{ event: 'token', data: { t: 'Hel' } }]).slice(10)]));
    const events = await firstValueFrom(
      sseStream<{ t: string }>('http://api.test/x', { content: 'q' }, { headers: { Authorization: 'Bearer t' }, fetchFn }).pipe(toArray()),
    );
    expect(events).toEqual([{ event: 'token', data: { t: 'Hel' }, id: null }]);
    const [url, init] = fetchFn.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('http://api.test/x');
    expect(init.method).toBe('POST');
    expect((init.headers as Record<string, string>)['Authorization']).toBe('Bearer t');
    expect(init.body).toBe(JSON.stringify({ content: 'q' }));
  });

  it('maps a problem+json response to AppError before the stream starts', async () => {
    const problem = { title: 'Too many requests', status: 429, code: 'RATE_LIMITED', detail: 'slow down' };
    const fetchFn = vi.fn(async () => new Response(JSON.stringify(problem), { status: 429, headers: { 'Content-Type': 'application/problem+json' } }));
    const error = await firstValueFrom(sseStream('http://api.test/x', {}, { fetchFn })).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(AppError);
    expect((error as AppError).code).toBe('RATE_LIMITED');
    expect((error as AppError).status).toBe(429);
  });

  it('aborts the fetch when unsubscribed', async () => {
    let signal: AbortSignal | undefined;
    const fetchFn = vi.fn((_url: string, init?: RequestInit) => {
      signal = init?.signal ?? undefined;
      return new Promise<Response>(() => undefined);
    });
    const sub = sseStream('http://api.test/x', undefined, { fetchFn: fetchFn as unknown as typeof fetch }).subscribe();
    sub.unsubscribe();
    expect(signal?.aborted).toBe(true);
  });
});
