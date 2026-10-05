import { HttpClient, HttpContext, HttpResponse } from '@angular/common/http';
import { Observable } from 'rxjs';
import { filter, map } from 'rxjs/operators';
import { StrictHttpResponse } from '../../strict-http-response';
import { RequestBuilder } from '../../request-builder';
import { FeedbackIn } from '../../models/feedback-in';
import { FeedbackOut } from '../../models/feedback-out';
export interface SendFeedback$Params {
    message_id: string;
    body: FeedbackIn;
}
export function sendFeedback(http: HttpClient, rootUrl: string, params: SendFeedback$Params, context?: HttpContext): Observable<StrictHttpResponse<FeedbackOut>> {
    const rb = new RequestBuilder(rootUrl, sendFeedback.PATH, 'post');
    if (params) {
        rb.path('message_id', params.message_id, {});
        rb.body(params.body, 'application/json');
    }
    return http.request(rb.build({ responseType: 'json', accept: 'application/json', context })).pipe(filter((r: any): r is HttpResponse<any> => r instanceof HttpResponse), map((r: HttpResponse<any>) => {
        return r as StrictHttpResponse<FeedbackOut>;
    }));
}
sendFeedback.PATH = '/api/v1/chat/messages/{message_id}/feedback';
