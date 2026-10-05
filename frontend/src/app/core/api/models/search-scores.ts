export interface SearchScores {
    lexical_rank: (number | null);
    lexical_score: (number | null);
    rerank: (number | null);
    rrf: number;
    vector_rank: (number | null);
    vector_score: (number | null);
}
