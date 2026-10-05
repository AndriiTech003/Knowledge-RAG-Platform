import { HttpClient, HttpContext, HttpResponse } from '@angular/common/http';
import { Observable } from 'rxjs';
import { filter, map } from 'rxjs/operators';
import { StrictHttpResponse } from '../../strict-http-response';
import { RequestBuilder } from '../../request-builder';
import { EvalRunOut } from '../../models/eval-run-out';
export interface ListEvalRuns$Params {
    limit?: number;
}
export function listEvalRuns(http: HttpClient, rootUrl: string, params?: ListEvalRuns$Params, context?: HttpContext): Observable<StrictHttpResponse<Array<EvalRunOut>>> {
    const rb = new RequestBuilder(rootUrl, listEvalRuns.PATH, 'get');
    if (params) {
        rb.query('limit', params.limit, {});
    }
    return http.request(rb.build({ responseType: 'json', accept: 'application/json', context })).pipe(filter((r: any): r is HttpResponse<any> => r instanceof HttpResponse), map((r: HttpResponse<any>) => {
        return r as StrictHttpResponse<Array<EvalRunOut>>;
    }));
}
listEvalRuns.PATH = '/api/v1/admin/eval/runs';
