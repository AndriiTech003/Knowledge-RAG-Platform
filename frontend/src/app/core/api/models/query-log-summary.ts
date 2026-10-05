export interface QueryLogSummary {
    condensed_question: (string | null);
    cost_usd: number;
    created_at: string;
    id: string;
    input_tokens: (number | null);
    model: (string | null);
    outcome: (string | null);
    output_tokens: (number | null);
    question: (string | null);
    timings_ms: {
        [key: string]: number;
    };
    user: (string | null);
}
