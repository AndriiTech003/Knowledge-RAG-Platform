import { SearchScores } from '../models/search-scores';
export interface SearchHit {
    chunk_id: string;
    collection_id: string;
    document_id: string;
    heading_path: Array<string>;
    mime_type: string;
    page: (number | null);
    page_end: (number | null);
    rank: number;
    scores: SearchScores;
    snippet: string;
    text: string;
    title: string;
}
