import { HttpClient, HttpContext, HttpResponse } from '@angular/common/http';
import { Observable } from 'rxjs';
import { filter, map } from 'rxjs/operators';
import { StrictHttpResponse } from '../../strict-http-response';
import { RequestBuilder } from '../../request-builder';
import { ConversationOut } from '../../models/conversation-out';
import { ConversationPatch } from '../../models/conversation-patch';
export interface RenameConversation$Params {
    conversation_id: string;
    body: ConversationPatch;
}
export function renameConversation(http: HttpClient, rootUrl: string, params: RenameConversation$Params, context?: HttpContext): Observable<StrictHttpResponse<ConversationOut>> {
    const rb = new RequestBuilder(rootUrl, renameConversation.PATH, 'patch');
    if (params) {
        rb.path('conversation_id', params.conversation_id, {});
        rb.body(params.body, 'application/json');
    }
    return http.request(rb.build({ responseType: 'json', accept: 'application/json', context })).pipe(filter((r: any): r is HttpResponse<any> => r instanceof HttpResponse), map((r: HttpResponse<any>) => {
        return r as StrictHttpResponse<ConversationOut>;
    }));
}
renameConversation.PATH = '/api/v1/chat/conversations/{conversation_id}';
