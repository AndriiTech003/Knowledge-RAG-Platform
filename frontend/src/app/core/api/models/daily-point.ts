export interface DailyPoint {
    cost_usd: number;
    day: string;
    no_answer: number;
    p95_ms: (number | null);
    questions: number;
    users: number;
}
