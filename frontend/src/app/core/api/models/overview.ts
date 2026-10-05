import { DailyPoint } from '../models/daily-point';
import { Percentiles } from '../models/percentiles';
import { TokenTotals } from '../models/token-totals';
export interface Overview {
    active_users: number;
    cost_per_question_usd: number;
    cost_usd: number;
    daily: Array<DailyPoint>;
    errors: number;
    feedback_down: number;
    feedback_up: number;
    first_token_ms: Percentiles;
    from: string;
    latency_ms: Percentiles;
    no_answer: number;
    no_answer_rate: number;
    questions: number;
    steps_ms: {
        [key: string]: Percentiles;
    };
    to: string;
    tokens: TokenTotals;
}
