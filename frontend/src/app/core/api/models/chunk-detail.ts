export interface ChunkDetail {
    char_end: (number | null);
    char_start: (number | null);
    collection_id: string;
    content_hash: string;
    document_id: string;
    document_title: string;
    embedding_model: (string | null);
    heading_path: Array<string>;
    id: string;
    mime_type: string;
    ordinal: number;
    page_end: (number | null);
    page_start: (number | null);
    text: string;
    token_count: number;
}
