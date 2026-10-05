import { HttpClient, HttpContext, HttpResponse } from '@angular/common/http';
import { Observable } from 'rxjs';
import { filter, map } from 'rxjs/operators';
import { StrictHttpResponse } from '../../strict-http-response';
import { RequestBuilder } from '../../request-builder';
import { QueryLogSummary } from '../../models/query-log-summary';
export interface ListQueryLogs$Params {
    outcome?: (string | null);
    cursor?: (string | null);
    limit?: number;
}
export function listQueryLogs(http: HttpClient, rootUrl: string, params?: ListQueryLogs$Params, context?: HttpContext): Observable<StrictHttpResponse<Array<QueryLogSummary>>> {
    const rb = new RequestBuilder(rootUrl, listQueryLogs.PATH, 'get');
    if (params) {
        rb.query('outcome', params.outcome, {});
        rb.query('cursor', params.cursor, {});
        rb.query('limit', params.limit, {});
    }
    return http.request(rb.build({ responseType: 'json', accept: 'application/json', context })).pipe(filter((r: any): r is HttpResponse<any> => r instanceof HttpResponse), map((r: HttpResponse<any>) => {
        return r as StrictHttpResponse<Array<QueryLogSummary>>;
    }));
}
listQueryLogs.PATH = '/api/v1/admin/query-logs';
