import { MessageOut } from '../models/message-out';
export interface PageMessageOut {
    items: Array<MessageOut>;
    next_cursor?: (string | null);
}
