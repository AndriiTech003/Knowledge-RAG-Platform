import { HttpClient, HttpContext } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { BaseService } from '../base-service';
import { ApiConfiguration } from '../api-configuration';
import { StrictHttpResponse } from '../strict-http-response';
import { ConversationOut } from '../models/conversation-out';
import { createConversation } from '../fn/chat/create-conversation';
import { CreateConversation$Params } from '../fn/chat/create-conversation';
import { deleteConversation } from '../fn/chat/delete-conversation';
import { DeleteConversation$Params } from '../fn/chat/delete-conversation';
import { getConversation } from '../fn/chat/get-conversation';
import { GetConversation$Params } from '../fn/chat/get-conversation';
import { listConversations } from '../fn/chat/list-conversations';
import { ListConversations$Params } from '../fn/chat/list-conversations';
import { listMessages } from '../fn/chat/list-messages';
import { ListMessages$Params } from '../fn/chat/list-messages';
import { PageConversationOut } from '../models/page-conversation-out';
import { PageMessageOut } from '../models/page-message-out';
import { renameConversation } from '../fn/chat/rename-conversation';
import { RenameConversation$Params } from '../fn/chat/rename-conversation';
import { sendMessage } from '../fn/chat/send-message';
import { SendMessage$Params } from '../fn/chat/send-message';
import { stopMessage } from '../fn/chat/stop-message';
import { StopMessage$Params } from '../fn/chat/stop-message';
@Injectable({ providedIn: 'root' })
export class ChatService extends BaseService {
    constructor(config: ApiConfiguration, http: HttpClient) {
        super(config, http);
    }
    static readonly ListConversationsPath = '/api/v1/chat/conversations';
    listConversations$Response(params?: ListConversations$Params, context?: HttpContext): Observable<StrictHttpResponse<PageConversationOut>> {
        const obs = listConversations(this.http, this.rootUrl, params, context);
        return obs;
    }
    listConversations(params?: ListConversations$Params, context?: HttpContext): Observable<PageConversationOut> {
        const resp = this.listConversations$Response(params, context);
        return resp.pipe(map((r: StrictHttpResponse<PageConversationOut>): PageConversationOut => r.body));
    }
    static readonly CreateConversationPath = '/api/v1/chat/conversations';
    createConversation$Response(params: CreateConversation$Params, context?: HttpContext): Observable<StrictHttpResponse<ConversationOut>> {
        const obs = createConversation(this.http, this.rootUrl, params, context);
        return obs;
    }
    createConversation(params: CreateConversation$Params, context?: HttpContext): Observable<ConversationOut> {
        const resp = this.createConversation$Response(params, context);
        return resp.pipe(map((r: StrictHttpResponse<ConversationOut>): ConversationOut => r.body));
    }
    static readonly GetConversationPath = '/api/v1/chat/conversations/{conversation_id}';
    getConversation$Response(params: GetConversation$Params, context?: HttpContext): Observable<StrictHttpResponse<ConversationOut>> {
        const obs = getConversation(this.http, this.rootUrl, params, context);
        return obs;
    }
    getConversation(params: GetConversation$Params, context?: HttpContext): Observable<ConversationOut> {
        const resp = this.getConversation$Response(params, context);
        return resp.pipe(map((r: StrictHttpResponse<ConversationOut>): ConversationOut => r.body));
    }
    static readonly DeleteConversationPath = '/api/v1/chat/conversations/{conversation_id}';
    deleteConversation$Response(params: DeleteConversation$Params, context?: HttpContext): Observable<StrictHttpResponse<void>> {
        const obs = deleteConversation(this.http, this.rootUrl, params, context);
        return obs;
    }
    deleteConversation(params: DeleteConversation$Params, context?: HttpContext): Observable<void> {
        const resp = this.deleteConversation$Response(params, context);
        return resp.pipe(map((r: StrictHttpResponse<void>): void => r.body));
    }
    static readonly RenameConversationPath = '/api/v1/chat/conversations/{conversation_id}';
    renameConversation$Response(params: RenameConversation$Params, context?: HttpContext): Observable<StrictHttpResponse<ConversationOut>> {
        const obs = renameConversation(this.http, this.rootUrl, params, context);
        return obs;
    }
    renameConversation(params: RenameConversation$Params, context?: HttpContext): Observable<ConversationOut> {
        const resp = this.renameConversation$Response(params, context);
        return resp.pipe(map((r: StrictHttpResponse<ConversationOut>): ConversationOut => r.body));
    }
    static readonly ListMessagesPath = '/api/v1/chat/conversations/{conversation_id}/messages';
    listMessages$Response(params: ListMessages$Params, context?: HttpContext): Observable<StrictHttpResponse<PageMessageOut>> {
        const obs = listMessages(this.http, this.rootUrl, params, context);
        return obs;
    }
    listMessages(params: ListMessages$Params, context?: HttpContext): Observable<PageMessageOut> {
        const resp = this.listMessages$Response(params, context);
        return resp.pipe(map((r: StrictHttpResponse<PageMessageOut>): PageMessageOut => r.body));
    }
    static readonly SendMessagePath = '/api/v1/chat/conversations/{conversation_id}/messages';
    sendMessage$Response(params: SendMessage$Params, context?: HttpContext): Observable<StrictHttpResponse<any>> {
        const obs = sendMessage(this.http, this.rootUrl, params, context);
        return obs;
    }
    sendMessage(params: SendMessage$Params, context?: HttpContext): Observable<any> {
        const resp = this.sendMessage$Response(params, context);
        return resp.pipe(map((r: StrictHttpResponse<any>): any => r.body));
    }
    static readonly StopMessagePath = '/api/v1/chat/messages/{message_id}/stop';
    stopMessage$Response(params: StopMessage$Params, context?: HttpContext): Observable<StrictHttpResponse<{
        [key: string]: boolean;
    }>> {
        const obs = stopMessage(this.http, this.rootUrl, params, context);
        return obs;
    }
    stopMessage(params: StopMessage$Params, context?: HttpContext): Observable<{
        [key: string]: boolean;
    }> {
        const resp = this.stopMessage$Response(params, context);
        return resp.pipe(map((r: StrictHttpResponse<{
            [key: string]: boolean;
        }>): {
            [key: string]: boolean;
        } => r.body));
    }
}
