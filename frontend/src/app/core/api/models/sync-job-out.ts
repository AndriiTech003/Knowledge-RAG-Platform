export interface SyncJobOut {
    error: (string | null);
    finished_at: (string | null);
    id: string;
    started_at: (string | null);
    stats: ({
        [key: string]: any;
    } | null);
    status: string;
}
