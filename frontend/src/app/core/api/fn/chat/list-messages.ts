import { HttpClient, HttpContext, HttpResponse } from '@angular/common/http';
import { Observable } from 'rxjs';
import { filter, map } from 'rxjs/operators';
import { StrictHttpResponse } from '../../strict-http-response';
import { RequestBuilder } from '../../request-builder';
import { PageMessageOut } from '../../models/page-message-out';
export interface ListMessages$Params {
    conversation_id: string;
    cursor?: (string | null);
    limit?: number;
}
export function listMessages(http: HttpClient, rootUrl: string, params: ListMessages$Params, context?: HttpContext): Observable<StrictHttpResponse<PageMessageOut>> {
    const rb = new RequestBuilder(rootUrl, listMessages.PATH, 'get');
    if (params) {
        rb.path('conversation_id', params.conversation_id, {});
        rb.query('cursor', params.cursor, {});
        rb.query('limit', params.limit, {});
    }
    return http.request(rb.build({ responseType: 'json', accept: 'application/json', context })).pipe(filter((r: any): r is HttpResponse<any> => r instanceof HttpResponse), map((r: HttpResponse<any>) => {
        return r as StrictHttpResponse<PageMessageOut>;
    }));
}
listMessages.PATH = '/api/v1/chat/conversations/{conversation_id}/messages';
