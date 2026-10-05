import { HttpClient, HttpContext, HttpResponse } from '@angular/common/http';
import { Observable } from 'rxjs';
import { filter, map } from 'rxjs/operators';
import { StrictHttpResponse } from '../../strict-http-response';
import { RequestBuilder } from '../../request-builder';
export interface StopMessage$Params {
    message_id: string;
}
export function stopMessage(http: HttpClient, rootUrl: string, params: StopMessage$Params, context?: HttpContext): Observable<StrictHttpResponse<{
    [key: string]: boolean;
}>> {
    const rb = new RequestBuilder(rootUrl, stopMessage.PATH, 'post');
    if (params) {
        rb.path('message_id', params.message_id, {});
    }
    return http.request(rb.build({ responseType: 'json', accept: 'application/json', context })).pipe(filter((r: any): r is HttpResponse<any> => r instanceof HttpResponse), map((r: HttpResponse<any>) => {
        return r as StrictHttpResponse<{
            [key: string]: boolean;
        }>;
    }));
}
stopMessage.PATH = '/api/v1/chat/messages/{message_id}/stop';
