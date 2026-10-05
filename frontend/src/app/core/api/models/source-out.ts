export interface SourceOut {
    collection_id: string;
    config: {
        [key: string]: any;
    };
    document_count?: number;
    id: string;
    kind: string;
    last_error: (string | null);
    last_synced_at: (string | null);
    schedule: (string | null);
    status: (string | null);
}
