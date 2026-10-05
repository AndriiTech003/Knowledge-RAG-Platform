export interface RetrievedCandidate {
    chunk_id: string;
    document_id: string;
    lexical_rank?: (number | null);
    lexical_score?: (number | null);
    page?: (number | null);
    rerank_score?: (number | null);
    rrf: number;
    selected?: boolean;
    title: string;
    vector_rank?: (number | null);
    vector_score?: (number | null);
}
