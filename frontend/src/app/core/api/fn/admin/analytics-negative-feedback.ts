import { HttpClient, HttpContext, HttpResponse } from '@angular/common/http';
import { Observable } from 'rxjs';
import { filter, map } from 'rxjs/operators';
import { StrictHttpResponse } from '../../strict-http-response';
import { RequestBuilder } from '../../request-builder';
import { NegativeFeedbackItem } from '../../models/negative-feedback-item';
export interface AnalyticsNegativeFeedback$Params {
    cursor?: (string | null);
    limit?: number;
}
export function analyticsNegativeFeedback(http: HttpClient, rootUrl: string, params?: AnalyticsNegativeFeedback$Params, context?: HttpContext): Observable<StrictHttpResponse<Array<NegativeFeedbackItem>>> {
    const rb = new RequestBuilder(rootUrl, analyticsNegativeFeedback.PATH, 'get');
    if (params) {
        rb.query('cursor', params.cursor, {});
        rb.query('limit', params.limit, {});
    }
    return http.request(rb.build({ responseType: 'json', accept: 'application/json', context })).pipe(filter((r: any): r is HttpResponse<any> => r instanceof HttpResponse), map((r: HttpResponse<any>) => {
        return r as StrictHttpResponse<Array<NegativeFeedbackItem>>;
    }));
}
analyticsNegativeFeedback.PATH = '/api/v1/admin/analytics/negative-feedback';
