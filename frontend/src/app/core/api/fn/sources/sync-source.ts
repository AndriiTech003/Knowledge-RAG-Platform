import { HttpClient, HttpContext, HttpResponse } from '@angular/common/http';
import { Observable } from 'rxjs';
import { filter, map } from 'rxjs/operators';
import { StrictHttpResponse } from '../../strict-http-response';
import { RequestBuilder } from '../../request-builder';
import { SourceOut } from '../../models/source-out';
export interface SyncSource$Params {
    source_id: string;
}
export function syncSource(http: HttpClient, rootUrl: string, params: SyncSource$Params, context?: HttpContext): Observable<StrictHttpResponse<SourceOut>> {
    const rb = new RequestBuilder(rootUrl, syncSource.PATH, 'post');
    if (params) {
        rb.path('source_id', params.source_id, {});
    }
    return http.request(rb.build({ responseType: 'json', accept: 'application/json', context })).pipe(filter((r: any): r is HttpResponse<any> => r instanceof HttpResponse), map((r: HttpResponse<any>) => {
        return r as StrictHttpResponse<SourceOut>;
    }));
}
syncSource.PATH = '/api/v1/sources/{source_id}/sync';
