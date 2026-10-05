export interface SearchRequest {
    collections?: (Array<string> | null);
    k?: number;
    mode?: 'vector' | 'lexical' | 'hybrid';
    query: string;
    rerank?: boolean;
}
