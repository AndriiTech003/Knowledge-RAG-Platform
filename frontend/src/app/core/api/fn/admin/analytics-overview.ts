import { HttpClient, HttpContext, HttpResponse } from '@angular/common/http';
import { Observable } from 'rxjs';
import { filter, map } from 'rxjs/operators';
import { StrictHttpResponse } from '../../strict-http-response';
import { RequestBuilder } from '../../request-builder';
import { Overview } from '../../models/overview';
export interface AnalyticsOverview$Params {
    from?: (string | null);
    to?: (string | null);
}
export function analyticsOverview(http: HttpClient, rootUrl: string, params?: AnalyticsOverview$Params, context?: HttpContext): Observable<StrictHttpResponse<Overview>> {
    const rb = new RequestBuilder(rootUrl, analyticsOverview.PATH, 'get');
    if (params) {
        rb.query('from', params.from, {});
        rb.query('to', params.to, {});
    }
    return http.request(rb.build({ responseType: 'json', accept: 'application/json', context })).pipe(filter((r: any): r is HttpResponse<any> => r instanceof HttpResponse), map((r: HttpResponse<any>) => {
        return r as StrictHttpResponse<Overview>;
    }));
}
analyticsOverview.PATH = '/api/v1/admin/analytics/overview';
