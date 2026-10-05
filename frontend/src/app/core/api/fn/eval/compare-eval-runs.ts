import { HttpClient, HttpContext, HttpResponse } from '@angular/common/http';
import { Observable } from 'rxjs';
import { filter, map } from 'rxjs/operators';
import { StrictHttpResponse } from '../../strict-http-response';
import { RequestBuilder } from '../../request-builder';
import { CompareOut } from '../../models/compare-out';
export interface CompareEvalRuns$Params {
    a: string;
    b: string;
}
export function compareEvalRuns(http: HttpClient, rootUrl: string, params: CompareEvalRuns$Params, context?: HttpContext): Observable<StrictHttpResponse<CompareOut>> {
    const rb = new RequestBuilder(rootUrl, compareEvalRuns.PATH, 'get');
    if (params) {
        rb.query('a', params.a, {});
        rb.query('b', params.b, {});
    }
    return http.request(rb.build({ responseType: 'json', accept: 'application/json', context })).pipe(filter((r: any): r is HttpResponse<any> => r instanceof HttpResponse), map((r: HttpResponse<any>) => {
        return r as StrictHttpResponse<CompareOut>;
    }));
}
compareEvalRuns.PATH = '/api/v1/admin/eval/compare';
