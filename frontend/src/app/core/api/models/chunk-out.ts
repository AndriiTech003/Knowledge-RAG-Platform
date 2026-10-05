export interface ChunkOut {
    char_end: (number | null);
    char_start: (number | null);
    content_hash: string;
    document_id: string;
    embedding_model: (string | null);
    heading_path: Array<string>;
    id: string;
    ordinal: number;
    page_end: (number | null);
    page_start: (number | null);
    text: string;
    token_count: number;
}
