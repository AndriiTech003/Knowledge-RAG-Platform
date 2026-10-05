import { Subject, of, delay } from 'rxjs';
import { SearchResponse } from '../../core/api/models';
import { SearchParams, SearchState, searchPipeline } from './search-query';

const base: SearchParams = { query: '', mode: 'hybrid', rerank: true, collections: [], k: 10 };
const response = (query: string): SearchResponse => ({ query, mode: 'hybrid', rerank: true, results: [], candidates: 0, timings_ms: {} });

describe('searchPipeline', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('debounces input and cancels stale requests with switchMap', () => {
    const params = new Subject<SearchParams>();
    const search = vi.fn((req: { query: string }) => of(response(req.query)).pipe(delay(500)));
    const states: SearchState[] = [];
    searchPipeline(params, search, 300).subscribe((s) => states.push(s));
    params.next({ ...base, query: 'tr' });
    params.next({ ...base, query: 'tra' });
    params.next({ ...base, query: 'travel' });
    vi.advanceTimersByTime(300);
    expect(search).toHaveBeenCalledTimes(1);
    expect(search.mock.calls[0][0].query).toBe('travel');
    params.next({ ...base, query: 'travel', mode: 'lexical' });
    vi.advanceTimersByTime(300);
    expect(search).toHaveBeenCalledTimes(2);
    vi.advanceTimersByTime(600);
    const done = states.filter((s) => s.status === 'done');
    expect(done).toHaveLength(1);
    expect(done[0].params?.mode).toBe('lexical');
  });

  it('returns idle for short queries without calling the API', () => {
    const params = new Subject<SearchParams>();
    const search = vi.fn(() => of(response('x')));
    const states: SearchState[] = [];
    searchPipeline(params, search, 300).subscribe((s) => states.push(s));
    params.next({ ...base, query: 'a' });
    vi.advanceTimersByTime(300);
    expect(search).not.toHaveBeenCalled();
    expect(states[0].status).toBe('idle');
  });
});
