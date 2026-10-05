import { HttpClient, HttpContext, HttpResponse } from '@angular/common/http';
import { Observable } from 'rxjs';
import { filter, map } from 'rxjs/operators';
import { StrictHttpResponse } from '../../strict-http-response';
import { RequestBuilder } from '../../request-builder';
import { MessageCreate } from '../../models/message-create';
export interface SendMessage$Params {
    conversation_id: string;
    body: MessageCreate;
}
export function sendMessage(http: HttpClient, rootUrl: string, params: SendMessage$Params, context?: HttpContext): Observable<StrictHttpResponse<any>> {
    const rb = new RequestBuilder(rootUrl, sendMessage.PATH, 'post');
    if (params) {
        rb.path('conversation_id', params.conversation_id, {});
        rb.body(params.body, 'application/json');
    }
    return http.request(rb.build({ responseType: 'text', accept: 'text/event-stream', context })).pipe(filter((r: any): r is HttpResponse<any> => r instanceof HttpResponse), map((r: HttpResponse<any>) => {
        return r as StrictHttpResponse<any>;
    }));
}
sendMessage.PATH = '/api/v1/chat/conversations/{conversation_id}/messages';
