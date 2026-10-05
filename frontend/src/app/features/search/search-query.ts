import { Observable, catchError, debounceTime, distinctUntilChanged, map, of, startWith, switchMap } from 'rxjs';
import { SearchRequest, SearchResponse } from '../../core/api/models';
import { AppError } from '../../core/http/app-error';

export type SearchMode = 'vector' | 'lexical' | 'hybrid';

export interface SearchParams {
  query: string;
  mode: SearchMode;
  rerank: boolean;
  collections: string[];
  k: number;
}

export interface SearchState {
  status: 'idle' | 'loading' | 'done' | 'error';
  params: SearchParams | null;
  response: SearchResponse | null;
  error: AppError | null;
}

export const IDLE_SEARCH: SearchState = { status: 'idle', params: null, response: null, error: null };

export function sameParams(a: SearchParams, b: SearchParams): boolean {
  return (
    a.query.trim() === b.query.trim() &&
    a.mode === b.mode &&
    a.rerank === b.rerank &&
    a.k === b.k &&
    a.collections.join(',') === b.collections.join(',')
  );
}

export function toRequest(params: SearchParams): SearchRequest {
  return {
    query: params.query.trim(),
    mode: params.mode,
    rerank: params.rerank,
    k: params.k,
    collections: params.collections.length ? params.collections : null,
  };
}

export function searchPipeline(
  params$: Observable<SearchParams>,
  search: (request: SearchRequest) => Observable<SearchResponse>,
  debounceMs = 300,
  minLength = 2,
): Observable<SearchState> {
  return params$.pipe(
    debounceTime(debounceMs),
    distinctUntilChanged(sameParams),
    switchMap((params) => {
      if (params.query.trim().length < minLength) return of(IDLE_SEARCH);
      return search(toRequest(params)).pipe(
        map((response): SearchState => ({ status: 'done', params, response, error: null })),
        catchError((error: unknown) => of<SearchState>({ status: 'error', params, response: null, error: AppError.from(error) })),
        startWith<SearchState>({ status: 'loading', params, response: null, error: null }),
      );
    }),
  );
}
