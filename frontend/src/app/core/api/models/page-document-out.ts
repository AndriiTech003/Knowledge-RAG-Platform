import { DocumentOut } from '../models/document-out';
export interface PageDocumentOut {
    items: Array<DocumentOut>;
    next_cursor?: (string | null);
}
