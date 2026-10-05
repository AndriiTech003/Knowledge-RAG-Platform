import { HttpClient, HttpContext, HttpResponse } from '@angular/common/http';
import { Observable } from 'rxjs';
import { filter, map } from 'rxjs/operators';
import { StrictHttpResponse } from '../../strict-http-response';
import { RequestBuilder } from '../../request-builder';
import { EvalRunDetail } from '../../models/eval-run-detail';
export interface GetEvalRun$Params {
    run_id: string;
}
export function getEvalRun(http: HttpClient, rootUrl: string, params: GetEvalRun$Params, context?: HttpContext): Observable<StrictHttpResponse<EvalRunDetail>> {
    const rb = new RequestBuilder(rootUrl, getEvalRun.PATH, 'get');
    if (params) {
        rb.path('run_id', params.run_id, {});
    }
    return http.request(rb.build({ responseType: 'json', accept: 'application/json', context })).pipe(filter((r: any): r is HttpResponse<any> => r instanceof HttpResponse), map((r: HttpResponse<any>) => {
        return r as StrictHttpResponse<EvalRunDetail>;
    }));
}
getEvalRun.PATH = '/api/v1/admin/eval/runs/{run_id}';
