import { HttpClient, HttpContext, HttpResponse } from '@angular/common/http';
import { Observable } from 'rxjs';
import { filter, map } from 'rxjs/operators';
import { StrictHttpResponse } from '../../strict-http-response';
import { RequestBuilder } from '../../request-builder';
import { PageConversationOut } from '../../models/page-conversation-out';
export interface ListConversations$Params {
    q?: (string | null);
    cursor?: (string | null);
    limit?: number;
}
export function listConversations(http: HttpClient, rootUrl: string, params?: ListConversations$Params, context?: HttpContext): Observable<StrictHttpResponse<PageConversationOut>> {
    const rb = new RequestBuilder(rootUrl, listConversations.PATH, 'get');
    if (params) {
        rb.query('q', params.q, {});
        rb.query('cursor', params.cursor, {});
        rb.query('limit', params.limit, {});
    }
    return http.request(rb.build({ responseType: 'json', accept: 'application/json', context })).pipe(filter((r: any): r is HttpResponse<any> => r instanceof HttpResponse), map((r: HttpResponse<any>) => {
        return r as StrictHttpResponse<PageConversationOut>;
    }));
}
listConversations.PATH = '/api/v1/chat/conversations';
