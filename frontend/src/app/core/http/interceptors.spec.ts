import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { provideTestRuntime, TEST_CONFIG } from '../../../testing/test-helpers';
import { AppError } from './app-error';
import { authInterceptor } from './auth.interceptor';
import { CORRELATION_HEADER, correlationIdInterceptor } from './correlation-id.interceptor';
import { errorInterceptor } from './error.interceptor';
import { retryInterceptorWith } from './retry.interceptor';

const API = `${TEST_CONFIG.apiUrl}/api/v1`;

function setup() {
  TestBed.configureTestingModule({
    providers: [
      ...provideTestRuntime(),
      provideHttpClient(
        withInterceptors([correlationIdInterceptor, authInterceptor, errorInterceptor, retryInterceptorWith({ count: 2, baseDelayMs: 0 })]),
      ),
      provideHttpClientTesting(),
    ],
  });
  return { http: TestBed.inject(HttpClient), ctrl: TestBed.inject(HttpTestingController) };
}

describe('HTTP interceptors', () => {
  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it('adds the bearer token and a correlation id to API requests', () => {
    const { http, ctrl } = setup();
    http.get(`${API}/me`).subscribe();
    const req = ctrl.expectOne(`${API}/me`);
    expect(req.request.headers.get('Authorization')).toBe('Bearer test-token');
    expect(req.request.headers.get(CORRELATION_HEADER)).toMatch(/[0-9a-f-]{8,}/);
    req.flush({});
  });

  it('does not leak the token to third-party hosts such as presigned MinIO URLs', () => {
    const { http, ctrl } = setup();
    http.put('http://minio.test/bucket/key', 'x').subscribe();
    const req = ctrl.expectOne('http://minio.test/bucket/key');
    expect(req.request.headers.has('Authorization')).toBe(false);
    expect(req.request.headers.has(CORRELATION_HEADER)).toBe(false);
    req.flush(null);
  });

  it('maps problem+json responses to a typed AppError', async () => {
    const { http, ctrl } = setup();
    const result = firstValueFrom(http.post(`${API}/search`, {})).catch((e: unknown) => e);
    ctrl.expectOne(`${API}/search`).flush(
      { type: 'about:blank', title: 'Forbidden', status: 403, code: 'COLLECTION_FORBIDDEN', detail: 'No access', correlation_id: 'abc' },
      { status: 403, statusText: 'Forbidden', headers: { 'Content-Type': 'application/problem+json' } },
    );
    const error = (await result) as AppError;
    expect(error).toBeInstanceOf(AppError);
    expect(error.code).toBe('COLLECTION_FORBIDDEN');
    expect(error.detail).toBe('No access');
    expect(error.correlationId).toBe('abc');
  });

  it('maps FastAPI validation errors', async () => {
    const { http, ctrl } = setup();
    const result = firstValueFrom(http.post(`${API}/collections`, {})).catch((e: unknown) => e);
    ctrl.expectOne(`${API}/collections`).flush({ detail: [{ loc: ['body', 'name'], msg: 'Field required', type: 'missing' }] }, { status: 422, statusText: 'Unprocessable' });
    const error = (await result) as AppError;
    expect(error.code).toBe('VALIDATION');
    expect(error.fieldErrors).toHaveLength(1);
  });

  it('retries idempotent GET requests on 503 and then succeeds', async () => {
    const { http, ctrl } = setup();
    const result = firstValueFrom(http.get<{ ok: boolean }>(`${API}/collections`));
    ctrl.expectOne(`${API}/collections`).flush(null, { status: 503, statusText: 'Unavailable' });
    await new Promise((r) => setTimeout(r, 5));
    ctrl.expectOne(`${API}/collections`).flush({ ok: true });
    expect(await result).toEqual({ ok: true });
  });

  it('gives up after the retry budget and surfaces the error', async () => {
    const { http, ctrl } = setup();
    const result = firstValueFrom(http.get(`${API}/collections`)).catch((e: unknown) => e);
    for (let i = 0; i < 3; i += 1) {
      ctrl.expectOne(`${API}/collections`).flush(null, { status: 502, statusText: 'Bad Gateway' });
      await new Promise((r) => setTimeout(r, 5));
    }
    expect(((await result) as AppError).status).toBe(502);
  });

  it('never retries POST requests or client errors', async () => {
    const { http, ctrl } = setup();
    const post = firstValueFrom(http.post(`${API}/search`, {})).catch((e: unknown) => e);
    ctrl.expectOne(`${API}/search`).flush(null, { status: 503, statusText: 'Unavailable' });
    expect(((await post) as AppError).status).toBe(503);
    const get = firstValueFrom(http.get(`${API}/me`)).catch((e: unknown) => e);
    ctrl.expectOne(`${API}/me`).flush(null, { status: 404, statusText: 'Not Found' });
    expect(((await get) as AppError).code).toBe('NOT_FOUND');
  });
});
