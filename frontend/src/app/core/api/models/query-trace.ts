import { CollectionRef } from '../models/collection-ref';
import { RetrievedCandidate } from '../models/retrieved-candidate';
export interface QueryTrace {
    allowed_collections: Array<CollectionRef>;
    answer: (string | null);
    citations: Array<{
        [key: string]: any;
    }>;
    condensed_question: (string | null);
    conversation_id: (string | null);
    cost_usd: number;
    created_at: string;
    id: string;
    input_tokens: (number | null);
    message_id: (string | null);
    message_meta: {
        [key: string]: any;
    };
    message_status: (string | null);
    model: (string | null);
    outcome: (string | null);
    output_tokens: (number | null);
    prompt: (string | null);
    prompt_version: (string | null);
    question: (string | null);
    retrieved: Array<RetrievedCandidate>;
    timings_ms: {
        [key: string]: number;
    };
    user: (string | null);
}
