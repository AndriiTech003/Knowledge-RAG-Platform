export interface SourceCreate {
    config: {
        [key: string]: any;
    };
    kind: 'web' | 'notion';
    schedule?: (string | null);
}
