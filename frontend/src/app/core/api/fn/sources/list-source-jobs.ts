import { HttpClient, HttpContext, HttpResponse } from '@angular/common/http';
import { Observable } from 'rxjs';
import { filter, map } from 'rxjs/operators';
import { StrictHttpResponse } from '../../strict-http-response';
import { RequestBuilder } from '../../request-builder';
import { SyncJobOut } from '../../models/sync-job-out';
export interface ListSourceJobs$Params {
    source_id: string;
}
export function listSourceJobs(http: HttpClient, rootUrl: string, params: ListSourceJobs$Params, context?: HttpContext): Observable<StrictHttpResponse<Array<SyncJobOut>>> {
    const rb = new RequestBuilder(rootUrl, listSourceJobs.PATH, 'get');
    if (params) {
        rb.path('source_id', params.source_id, {});
    }
    return http.request(rb.build({ responseType: 'json', accept: 'application/json', context })).pipe(filter((r: any): r is HttpResponse<any> => r instanceof HttpResponse), map((r: HttpResponse<any>) => {
        return r as StrictHttpResponse<Array<SyncJobOut>>;
    }));
}
listSourceJobs.PATH = '/api/v1/sources/{source_id}/jobs';
