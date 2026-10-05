export interface SourcePatch {
    config?: ({
        [key: string]: any;
    } | null);
    schedule?: (string | null);
}
