import { HttpClient, HttpContext, HttpResponse } from '@angular/common/http';
import { Observable } from 'rxjs';
import { filter, map } from 'rxjs/operators';
import { StrictHttpResponse } from '../../strict-http-response';
import { RequestBuilder } from '../../request-builder';
import { QueryTrace } from '../../models/query-trace';
export interface GetQueryLog$Params {
    query_log_id: string;
}
export function getQueryLog(http: HttpClient, rootUrl: string, params: GetQueryLog$Params, context?: HttpContext): Observable<StrictHttpResponse<QueryTrace>> {
    const rb = new RequestBuilder(rootUrl, getQueryLog.PATH, 'get');
    if (params) {
        rb.path('query_log_id', params.query_log_id, {});
    }
    return http.request(rb.build({ responseType: 'json', accept: 'application/json', context })).pipe(filter((r: any): r is HttpResponse<any> => r instanceof HttpResponse), map((r: HttpResponse<any>) => {
        return r as StrictHttpResponse<QueryTrace>;
    }));
}
getQueryLog.PATH = '/api/v1/admin/query-logs/{query_log_id}';
