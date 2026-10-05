import { HttpClient, HttpContext, HttpResponse } from '@angular/common/http';
import { Observable } from 'rxjs';
import { filter, map } from 'rxjs/operators';
import { StrictHttpResponse } from '../../strict-http-response';
import { RequestBuilder } from '../../request-builder';
import { ConversationOut } from '../../models/conversation-out';
export interface GetConversation$Params {
    conversation_id: string;
}
export function getConversation(http: HttpClient, rootUrl: string, params: GetConversation$Params, context?: HttpContext): Observable<StrictHttpResponse<ConversationOut>> {
    const rb = new RequestBuilder(rootUrl, getConversation.PATH, 'get');
    if (params) {
        rb.path('conversation_id', params.conversation_id, {});
    }
    return http.request(rb.build({ responseType: 'json', accept: 'application/json', context })).pipe(filter((r: any): r is HttpResponse<any> => r instanceof HttpResponse), map((r: HttpResponse<any>) => {
        return r as StrictHttpResponse<ConversationOut>;
    }));
}
getConversation.PATH = '/api/v1/chat/conversations/{conversation_id}';
