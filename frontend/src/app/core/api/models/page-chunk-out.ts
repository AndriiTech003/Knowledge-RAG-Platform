import { ChunkOut } from '../models/chunk-out';
export interface PageChunkOut {
    items: Array<ChunkOut>;
    next_cursor?: (string | null);
}
