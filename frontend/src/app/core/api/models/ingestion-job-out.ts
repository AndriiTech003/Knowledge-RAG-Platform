export interface IngestionJobOut {
    attempts: number;
    error: (string | null);
    finished_at: (string | null);
    id: string;
    kind: string;
    started_at: (string | null);
    stats: ({
        [key: string]: any;
    } | null);
    status: string;
}
