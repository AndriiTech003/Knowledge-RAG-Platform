import { HttpClient, HttpEventType, HttpResponse } from '@angular/common/http';
import { computed, inject } from '@angular/core';
import { patchState, signalStore, withComputed, withMethods, withState } from '@ngrx/signals';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import {
  EMPTY,
  Observable,
  Subject,
  catchError,
  defer,
  filter,
  firstValueFrom,
  map,
  mergeMap,
  pipe,
  retry,
  switchMap,
  takeUntil,
  tap,
  timer,
} from 'rxjs';
import { DocumentOut, UploadUrlResponse } from '../../core/api/models';
import { DocumentsService } from '../../core/api/services';
import { AppError } from '../../core/http/app-error';
import { formatNumber, plural } from '../../core/i18n/plural';
import { SseClient } from '../../core/sse/sse-client';
import { SseEvent } from '../../core/sse/sse-parser';

export const MAX_PARALLEL_UPLOADS = 3;
export const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;

export type UploadStatus = 'queued' | 'uploading' | 'registering' | 'done' | 'error' | 'cancelled';

export interface UploadItem {
  id: string;
  file: File;
  name: string;
  size: number;
  progress: number;
  status: UploadStatus;
  error: string | null;
  documentId: string | null;
  newVersion: boolean;
}

export interface IngestionStats {
  chunks_total?: number;
  chunks_new?: number;
  chunks_unchanged?: number;
  chunks_deleted?: number;
  embed_ms?: number;
}

export interface DocumentStatusEvent {
  document_id: string;
  collection_id: string;
  title?: string | null;
  status: string;
  error?: string | null;
  stats?: IngestionStats | null;
}

export interface DocumentsState {
  collectionId: string | null;
  documents: DocumentOut[];
  loading: boolean;
  error: AppError | null;
  query: string;
  statusFilter: string;
  uploads: UploadItem[];
  stats: Record<string, IngestionStats>;
  live: boolean;
}

export const initialDocumentsState: DocumentsState = {
  collectionId: null,
  documents: [],
  loading: false,
  error: null,
  query: '',
  statusFilter: '',
  uploads: [],
  stats: {},
  live: false,
};

export function describeStats(stats: IngestionStats | null | undefined): string {
  if (!stats) return '';
  const total = stats.chunks_total ?? 0;
  const changed = stats.chunks_new ?? 0;
  const unchanged = stats.chunks_unchanged ?? 0;
  const deleted = stats.chunks_deleted ?? 0;
  const parts = [
    plural(changed, {
      one: $localize`:@@collections.stats.reembeddedOne:{count} chunk re-embedded`,
      few: $localize`:@@collections.stats.reembeddedFew:{count} chunks re-embedded`,
      many: $localize`:@@collections.stats.reembeddedMany:{count} chunks re-embedded`,
      other: $localize`:@@collections.stats.reembeddedOther:{count} chunks re-embedded`,
    }),
    $localize`:@@collections.stats.unchanged:${formatNumber(unchanged)}:count: unchanged`,
  ];
  if (deleted) parts.push($localize`:@@collections.stats.removed:${formatNumber(deleted)}:count: removed`);
  const summary = parts.join(', ');
  return total ? $localize`:@@collections.stats.withTotal:${summary}:summary: (${formatNumber(total)}:total: total)` : summary;
}

export function applyStatusEvent(documents: DocumentOut[], event: DocumentStatusEvent): DocumentOut[] {
  const index = documents.findIndex((d) => d.id === event.document_id);
  if (event.status === 'deleted') return index === -1 ? documents : documents.filter((d) => d.id !== event.document_id);
  const now = new Date().toISOString();
  if (index === -1) {
    const created: DocumentOut = {
      id: event.document_id,
      collection_id: event.collection_id,
      title: event.title ?? $localize`:@@collections.documents.untitled:Untitled`,
      status: event.status,
      error: event.error ?? null,
      mime_type: '',
      source_id: null,
      external_id: null,
      page_count: null,
      metadata: {},
      created_at: now,
      updated_at: now,
    };
    return [created, ...documents];
  }
  const next = [...documents];
  next[index] = {
    ...next[index],
    status: event.status,
    error: event.error ?? null,
    title: event.title ?? next[index].title,
    updated_at: now,
  };
  return next;
}

export function matchesFilter(doc: DocumentOut, query: string, status: string): boolean {
  if (status && doc.status !== status) return false;
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return doc.title.toLowerCase().includes(q) || doc.mime_type.toLowerCase().includes(q);
}

let uploadCounter = 0;

function guessContentType(file: File): string {
  if (file.type) return file.type;
  const name = file.name.toLowerCase();
  if (name.endsWith('.md') || name.endsWith('.markdown')) return 'text/markdown';
  if (name.endsWith('.pdf')) return 'application/pdf';
  if (name.endsWith('.html') || name.endsWith('.htm')) return 'text/html';
  if (name.endsWith('.docx')) return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  return 'application/octet-stream';
}

export const DocumentsStore = signalStore(
  withState<DocumentsState>(initialDocumentsState),
  withComputed(({ documents, query, statusFilter, uploads }) => ({
    filtered: computed(() => documents().filter((d) => matchesFilter(d, query(), statusFilter()))),
    activeUploads: computed(() => uploads().filter((u) => u.status === 'uploading' || u.status === 'registering').length),
    hasUploads: computed(() => uploads().length > 0),
    inProgress: computed(() => documents().filter((d) => !['ready', 'failed', 'deleted'].includes(d.status)).length),
  })),
  withMethods((store, api = inject(DocumentsService), http = inject(HttpClient), sse = inject(SseClient)) => {
    const cancel$ = new Subject<string>();
    const patchUpload = (id: string, patch: Partial<UploadItem>) =>
      patchState(store, (state) => ({ uploads: state.uploads.map((u) => (u.id === id ? { ...u, ...patch } : u)) }));
    const findUpload = (id: string) => store.uploads().find((u) => u.id === id) ?? null;

    const upsertDocument = (doc: DocumentOut) =>
      patchState(store, (state) => {
        const exists = state.documents.some((d) => d.id === doc.id);
        return { documents: exists ? state.documents.map((d) => (d.id === doc.id ? doc : d)) : [doc, ...state.documents] };
      });

    const uploadOne = (id: string): Observable<unknown> =>
      defer(() => {
        const item = findUpload(id);
        const collectionId = store.collectionId();
        if (!item || item.status !== 'queued' || !collectionId) return EMPTY;
        patchUpload(id, { status: 'uploading', progress: 0, error: null });
        const contentType = guessContentType(item.file);
        return api
          .createUploadUrl({ collection_id: collectionId, body: { filename: item.name, size: item.size, content_type: contentType } })
          .pipe(
            switchMap((target: UploadUrlResponse) =>
              http
                .request(target.method ?? 'PUT', target.upload_url, {
                  body: item.file,
                  headers: { 'Content-Type': contentType, ...(target.headers ?? {}) },
                  reportProgress: true,
                  observe: 'events',
                })
                .pipe(
                  tap((event) => {
                    if (event.type === HttpEventType.UploadProgress) {
                      const total = event.total ?? item.size;
                      patchUpload(id, { progress: total ? Math.min(99, Math.round((event.loaded / total) * 100)) : 0 });
                    }
                  }),
                  filter((event) => event.type === HttpEventType.Response),
                  map(() => target),
                ),
            ),
            tap(() => patchUpload(id, { status: 'registering', progress: 100 })),
            switchMap((target) =>
              api.registerDocument$Response({ collection_id: collectionId, body: { storage_key: target.storage_key, filename: item.name } }),
            ),
            tap((response: HttpResponse<DocumentOut>) => {
              const doc = response.body;
              if (doc) upsertDocument(doc);
              patchUpload(id, { status: 'done', documentId: doc?.id ?? null, newVersion: response.status === 200 });
            }),
            takeUntil(cancel$.pipe(filter((cancelled) => cancelled === id))),
            catchError((error: unknown) => {
              patchUpload(id, { status: 'error', error: AppError.from(error).userMessage });
              return EMPTY;
            }),
          );
      });

    const runUploads = rxMethod<string>(pipe(mergeMap((id) => uploadOne(id), MAX_PARALLEL_UPLOADS)));

    const load = rxMethod<string>(
      pipe(
        tap((collectionId) => {
          if (collectionId !== store.collectionId()) patchState(store, { ...initialDocumentsState, uploads: [], collectionId });
          patchState(store, { loading: true, error: null });
        }),
        switchMap((collectionId) =>
          api.listDocuments({ collection_id: collectionId, limit: 200 }).pipe(
            tap((page) => patchState(store, { documents: page.items, loading: false })),
            catchError((error: unknown) => {
              patchState(store, { loading: false, error: AppError.from(error) });
              return EMPTY;
            }),
          ),
        ),
      ),
    );

    const connectEvents = rxMethod<void>(
      pipe(
        switchMap(() =>
          sse.stream<unknown>('/documents/events').pipe(
            tap((event: SseEvent<unknown>) => {
              if (event.event === 'ready') {
                patchState(store, { live: true });
                return;
              }
              if (event.event !== 'status' || !event.data || typeof event.data !== 'object') return;
              const data = event.data as DocumentStatusEvent;
              if (data.collection_id !== store.collectionId()) return;
              patchState(store, (state) => ({
                documents: applyStatusEvent(state.documents, data),
                stats: data.stats ? { ...state.stats, [data.document_id]: data.stats } : state.stats,
              }));
            }),
            catchError((error: unknown) => {
              patchState(store, { live: false });
              throw error;
            }),
            retry({ delay: (_error, attempt) => timer(Math.min(30_000, 1000 * 2 ** Math.min(attempt, 5))) }),
          ),
        ),
      ),
    );

    return {
      load,
      connectEvents,
      setQuery(query: string): void {
        patchState(store, { query });
      },
      setStatusFilter(statusFilter: string): void {
        patchState(store, { statusFilter });
      },
      addFiles(files: File[]): UploadItem[] {
        const items: UploadItem[] = files.map((file) => {
          uploadCounter += 1;
          const tooBig = file.size > MAX_UPLOAD_BYTES;
          return {
            id: `upload-${Date.now().toString(36)}-${uploadCounter}`,
            file,
            name: file.name,
            size: file.size,
            progress: 0,
            status: tooBig ? 'error' : 'queued',
            error: tooBig ? $localize`:@@collections.uploads.tooLarge:File is larger than 50 MB` : null,
            documentId: null,
            newVersion: false,
          };
        });
        patchState(store, (state) => ({ uploads: [...items, ...state.uploads] }));
        for (const item of items) if (item.status === 'queued') runUploads(item.id);
        return items;
      },
      cancelUpload(id: string): void {
        const item = findUpload(id);
        if (!item || item.status === 'done' || item.status === 'cancelled') return;
        patchUpload(id, { status: 'cancelled', error: null });
        cancel$.next(id);
      },
      retryUpload(id: string): void {
        const item = findUpload(id);
        if (!item || (item.status !== 'error' && item.status !== 'cancelled')) return;
        patchUpload(id, { status: 'queued', progress: 0, error: null });
        runUploads(id);
      },
      dismissUpload(id: string): void {
        patchState(store, (state) => ({ uploads: state.uploads.filter((u) => u.id !== id) }));
      },
      clearFinishedUploads(): void {
        patchState(store, (state) => ({ uploads: state.uploads.filter((u) => u.status !== 'done' && u.status !== 'cancelled') }));
      },
      async reindex(documentId: string): Promise<boolean> {
        try {
          const doc = await firstValueFrom(api.reindexDocument({ document_id: documentId }));
          upsertDocument(doc);
          return true;
        } catch (error) {
          patchState(store, { error: AppError.from(error) });
          return false;
        }
      },
      async remove(documentId: string): Promise<boolean> {
        try {
          await firstValueFrom(api.deleteDocument({ document_id: documentId }));
          patchState(store, (state) => ({ documents: state.documents.filter((d) => d.id !== documentId) }));
          return true;
        } catch (error) {
          patchState(store, { error: AppError.from(error) });
          return false;
        }
      },
    };
  }),
);

export type DocumentsStoreInstance = InstanceType<typeof DocumentsStore>;
