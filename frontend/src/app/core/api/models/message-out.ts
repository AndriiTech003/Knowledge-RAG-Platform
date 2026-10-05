import { MessageFeedback } from '../models/message-feedback';
export interface MessageOut {
    citations: (Array<{
        [key: string]: any;
    }> | null);
    content: string;
    conversation_id: string;
    created_at: string;
    feedback?: (MessageFeedback | null);
    id: string;
    meta: ({
        [key: string]: any;
    } | null);
    query_log_id: (string | null);
    role: 'user' | 'assistant';
    status: (string | null);
}
