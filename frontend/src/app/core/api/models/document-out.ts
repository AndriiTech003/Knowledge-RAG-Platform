export interface DocumentOut {
    collection_id: string;
    created_at: string;
    error: (string | null);
    external_id: (string | null);
    id: string;
    metadata: {
        [key: string]: any;
    };
    mime_type: string;
    page_count: (number | null);
    source_id: (string | null);
    status: string;
    title: string;
    updated_at: string;
}
