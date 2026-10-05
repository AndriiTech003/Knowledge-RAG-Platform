import { ConversationOut } from '../models/conversation-out';
export interface PageConversationOut {
    items: Array<ConversationOut>;
    next_cursor?: (string | null);
}
