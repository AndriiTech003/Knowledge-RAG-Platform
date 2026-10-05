import { HttpClient, HttpContext, HttpResponse } from '@angular/common/http';
import { Observable } from 'rxjs';
import { filter, map } from 'rxjs/operators';
import { StrictHttpResponse } from '../../strict-http-response';
import { RequestBuilder } from '../../request-builder';
import { ConversationCreate } from '../../models/conversation-create';
import { ConversationOut } from '../../models/conversation-out';
export interface CreateConversation$Params {
    body: ConversationCreate;
}
export function createConversation(http: HttpClient, rootUrl: string, params: CreateConversation$Params, context?: HttpContext): Observable<StrictHttpResponse<ConversationOut>> {
    const rb = new RequestBuilder(rootUrl, createConversation.PATH, 'post');
    if (params) {
        rb.body(params.body, 'application/json');
    }
    return http.request(rb.build({ responseType: 'json', accept: 'application/json', context })).pipe(filter((r: any): r is HttpResponse<any> => r instanceof HttpResponse), map((r: HttpResponse<any>) => {
        return r as StrictHttpResponse<ConversationOut>;
    }));
}
createConversation.PATH = '/api/v1/chat/conversations';
