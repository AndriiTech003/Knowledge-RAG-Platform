import { CollectionOut } from '../models/collection-out';
export interface PageCollectionOut {
    items: Array<CollectionOut>;
    next_cursor?: (string | null);
}
