import { SearchHit } from '../models/search-hit';
export interface SearchResponse {
    candidates: number;
    degraded?: Array<string>;
    mode: string;
    query: string;
    rerank: boolean;
    results: Array<SearchHit>;
    timings_ms: {
        [key: string]: number;
    };
}
