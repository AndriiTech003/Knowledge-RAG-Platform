import { ChunkStats } from '../models/chunk-stats';
import { IngestionJobOut } from '../models/ingestion-job-out';
export interface DocumentDetail {
    chunk_stats: ChunkStats;
    collection_id: string;
    created_at: string;
    error: (string | null);
    external_id: (string | null);
    id: string;
    jobs: Array<IngestionJobOut>;
    metadata: {
        [key: string]: any;
    };
    mime_type: string;
    page_count: (number | null);
    role: string;
    source_id: (string | null);
    status: string;
    title: string;
    updated_at: string;
}
