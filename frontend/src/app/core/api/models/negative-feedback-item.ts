import { RetrievedCandidate } from '../models/retrieved-candidate';
export interface NegativeFeedbackItem {
    answer: (string | null);
    citations: Array<{
        [key: string]: any;
    }>;
    comment: (string | null);
    condensed_question: (string | null);
    created_at: string;
    id: string;
    message_id: string;
    outcome: (string | null);
    query_log_id: (string | null);
    question: (string | null);
    reason: (string | null);
    retrieved: Array<RetrievedCandidate>;
    user: (string | null);
}
