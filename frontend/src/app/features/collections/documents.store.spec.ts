import { HttpEventType, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Subject } from 'rxjs';
import { DocumentOut } from '../../core/api/models';
import { SseClient } from '../../core/sse/sse-client';
import { SseEvent } from '../../core/sse/sse-parser';
import { provideTestRuntime, TEST_CONFIG } from '../../../testing/test-helpers';
import { applyStatusEvent, describeStats, DocumentsStore, matchesFilter, MAX_PARALLEL_UPLOADS } from './documents.store';

const API = `${TEST_CONFIG.apiUrl}/api/v1`;

function doc(id: string, status = 'ready', title = `Doc ${id}`): DocumentOut {
  return {
    id,
    collection_id: 'col',
    title,
    status,
    error: null,
    mime_type: 'application/pdf',
    source_id: null,
    external_id: null,
    page_count: 3,
    metadata: {},
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  };
}

function setup() {
  const events = new Subject<SseEvent<unknown>>();
  TestBed.configureTestingModule({
    providers: [
      DocumentsStore,
      provideHttpClient(),
      provideHttpClientTesting(),
      ...provideTestRuntime(),
      { provide: SseClient, useValue: { stream: () => events.asObservable() } },
    ],
  });
  const store = TestBed.inject(DocumentsStore);
  const http = TestBed.inject(HttpTestingController);
  store.load('col');
  http.expectOne((r) => r.url === `${API}/collections/col/documents`).flush({ items: [doc('a'), doc('b', 'failed', 'Budget')], next_cursor: null });
  return { store, http, events };
}

function file(name: string, size = 1000): File {
  return new File([new Uint8Array(size)], name, { type: 'application/pdf' });
}

describe('DocumentsStore', () => {
  afterEach(() => TestBed.inject(HttpTestingController).verify({ ignoreCancelled: true }));

  it('loads documents for a collection', () => {
    const { store } = setup();
    expect(store.documents().map((d) => d.id)).toEqual(['a', 'b']);
    expect(store.loading()).toBe(false);
  });

  it('filters by text and status', () => {
    const { store } = setup();
    store.setQuery('budg');
    expect(store.filtered().map((d) => d.id)).toEqual(['b']);
    store.setQuery('');
    store.setStatusFilter('ready');
    expect(store.filtered().map((d) => d.id)).toEqual(['a']);
  });

  it('applies live SSE status events for the current collection only', () => {
    const { store, events } = setup();
    store.connectEvents();
    events.next({ event: 'ready', data: { collections: ['col'] }, id: null });
    expect(store.live()).toBe(true);
    events.next({ event: 'status', data: { document_id: 'a', collection_id: 'col', status: 'embedding' }, id: null });
    events.next({ event: 'status', data: { document_id: 'z', collection_id: 'other', status: 'queued' }, id: null });
    expect(store.documents().find((d) => d.id === 'a')?.status).toBe('embedding');
    expect(store.documents()).toHaveLength(2);
    events.next({
      event: 'status',
      data: { document_id: 'a', collection_id: 'col', status: 'ready', stats: { chunks_total: 200, chunks_new: 12, chunks_unchanged: 188 } },
      id: null,
    });
    expect(describeStats(store.stats()['a'])).toBe('12 chunks re-embedded, 188 unchanged (200 total)');
  });

  it('uploads a file: presigned URL, PUT with progress, then register', () => {
    const { store, http } = setup();
    const [item] = store.addFiles([file('guide.pdf')]);
    http.expectOne(`${API}/collections/col/documents/upload-url`).flush({ upload_url: 'http://minio.test/put', storage_key: 'k1', expires_in: 300, method: 'PUT', headers: {} });
    const put = http.expectOne('http://minio.test/put');
    expect(put.request.method).toBe('PUT');
    expect(put.request.headers.has('Authorization')).toBe(false);
    put.event({ type: HttpEventType.UploadProgress, loaded: 500, total: 1000 });
    expect(store.uploads()[0].progress).toBe(50);
    expect(store.uploads()[0].status).toBe('uploading');
    put.flush(null);
    const register = http.expectOne(`${API}/collections/col/documents`);
    expect(register.request.body).toEqual({ storage_key: 'k1', filename: 'guide.pdf' });
    register.flush(doc('new', 'queued', 'guide'), { status: 201, statusText: 'Created' });
    const done = store.uploads().find((u) => u.id === item.id);
    expect(done?.status).toBe('done');
    expect(done?.newVersion).toBe(false);
    expect(store.documents()[0].id).toBe('new');
  });

  it(`runs at most ${MAX_PARALLEL_UPLOADS} uploads in parallel`, () => {
    const { store, http } = setup();
    store.addFiles([file('1.pdf'), file('2.pdf'), file('3.pdf'), file('4.pdf')]);
    const requests = http.match(`${API}/collections/col/documents/upload-url`);
    expect(requests).toHaveLength(3);
    expect(store.uploads().filter((u) => u.status === 'queued')).toHaveLength(1);
    store.cancelUpload(store.uploads().find((u) => u.status === 'queued')!.id);
    for (const r of requests) store.cancelUpload(store.uploads().find((u) => u.name === r.request.body.filename)!.id);
    expect(store.uploads().every((u) => u.status === 'cancelled')).toBe(true);
  });

  it('marks failed uploads with an error and retries them', () => {
    const { store, http } = setup();
    const [item] = store.addFiles([file('bad.pdf')]);
    http.expectOne(`${API}/collections/col/documents/upload-url`).flush({ upload_url: 'http://minio.test/put', storage_key: 'k', expires_in: 300 });
    http.expectOne('http://minio.test/put').flush('denied', { status: 403, statusText: 'Forbidden' });
    expect(store.uploads()[0].status).toBe('error');
    expect(store.uploads()[0].error).toBeTruthy();
    store.retryUpload(item.id);
    expect(store.uploads()[0].status).toBe('uploading');
    http.expectOne(`${API}/collections/col/documents/upload-url`).flush({ upload_url: 'http://minio.test/put', storage_key: 'k', expires_in: 300 });
    const put = http.expectOne('http://minio.test/put');
    store.cancelUpload(item.id);
    expect(store.uploads()[0].status).toBe('cancelled');
    expect(put.cancelled).toBe(true);
  });

  it('rejects files above the size limit without uploading', () => {
    const { store } = setup();
    const big = { name: 'huge.pdf', size: 60 * 1024 * 1024, type: 'application/pdf' } as File;
    store.addFiles([big]);
    expect(store.uploads()[0].status).toBe('error');
  });

  it('reindexes and deletes documents', async () => {
    const { store, http } = setup();
    const reindex = store.reindex('a');
    http.expectOne(`${API}/documents/a/reindex`).flush(doc('a', 'queued'), { status: 202, statusText: 'Accepted' });
    expect(await reindex).toBe(true);
    expect(store.documents().find((d) => d.id === 'a')?.status).toBe('queued');
    const remove = store.remove('b');
    http.expectOne(`${API}/documents/b`).flush(null, { status: 204, statusText: 'No Content' });
    expect(await remove).toBe(true);
    expect(store.documents().map((d) => d.id)).toEqual(['a']);
  });
});

describe('documents helpers', () => {
  it('applyStatusEvent inserts unknown documents and removes deleted ones', () => {
    const list = applyStatusEvent([doc('a')], { document_id: 'n', collection_id: 'col', status: 'queued', title: 'New' });
    expect(list[0].title).toBe('New');
    expect(applyStatusEvent(list, { document_id: 'a', collection_id: 'col', status: 'deleted' }).map((d) => d.id)).toEqual(['n']);
  });

  it('matchesFilter is case-insensitive', () => {
    expect(matchesFilter(doc('a', 'ready', 'Travel Policy'), 'travel', '')).toBe(true);
    expect(matchesFilter(doc('a', 'ready', 'Travel Policy'), 'x', '')).toBe(false);
  });
});
