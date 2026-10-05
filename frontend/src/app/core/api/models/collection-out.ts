export interface CollectionOut {
    chunking_profile: string;
    created_at: string;
    created_by: string;
    description: (string | null);
    document_count?: number;
    embedding_model: string;
    id: string;
    name: string;
    ready_count?: number;
    role: string;
}
