export interface EvalRunCreate {
    k?: number;
    limit?: (number | null);
    mode?: 'retrieval' | 'full';
    name?: (string | null);
    rerank?: boolean;
    retrieval_mode?: 'vector' | 'lexical' | 'hybrid';
}
