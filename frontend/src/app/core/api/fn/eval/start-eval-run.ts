import { HttpClient, HttpContext, HttpResponse } from '@angular/common/http';
import { Observable } from 'rxjs';
import { filter, map } from 'rxjs/operators';
import { StrictHttpResponse } from '../../strict-http-response';
import { RequestBuilder } from '../../request-builder';
import { EvalRunCreate } from '../../models/eval-run-create';
import { EvalRunOut } from '../../models/eval-run-out';
export interface StartEvalRun$Params {
    body: EvalRunCreate;
}
export function startEvalRun(http: HttpClient, rootUrl: string, params: StartEvalRun$Params, context?: HttpContext): Observable<StrictHttpResponse<EvalRunOut>> {
    const rb = new RequestBuilder(rootUrl, startEvalRun.PATH, 'post');
    if (params) {
        rb.body(params.body, 'application/json');
    }
    return http.request(rb.build({ responseType: 'json', accept: 'application/json', context })).pipe(filter((r: any): r is HttpResponse<any> => r instanceof HttpResponse), map((r: HttpResponse<any>) => {
        return r as StrictHttpResponse<EvalRunOut>;
    }));
}
startEvalRun.PATH = '/api/v1/admin/eval/runs';
