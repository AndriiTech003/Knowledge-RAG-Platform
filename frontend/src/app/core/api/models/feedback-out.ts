export interface FeedbackOut {
    comment: (string | null);
    created_at: string;
    id: string;
    message_id: string;
    rating: number;
    reason: (string | null);
}
