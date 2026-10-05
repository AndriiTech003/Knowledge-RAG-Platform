export interface CollectionPatch {
    chunking_profile?: ('default' | 'small' | 'large' | null);
    description?: (string | null);
    embedding_model?: (string | null);
    name?: (string | null);
}
