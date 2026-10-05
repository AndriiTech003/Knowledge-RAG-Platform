export interface ClusterQuestion {
    created_at: string;
    query_log_id: string;
    question: (string | null);
    user: (string | null);
}
