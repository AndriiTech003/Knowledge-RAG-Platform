import { HttpClient, HttpContext, HttpResponse } from '@angular/common/http';
import { Observable } from 'rxjs';
import { filter, map } from 'rxjs/operators';
import { StrictHttpResponse } from '../../strict-http-response';
import { RequestBuilder } from '../../request-builder';
import { SourceOut } from '../../models/source-out';
import { SourcePatch } from '../../models/source-patch';
export interface UpdateSource$Params {
    collection_id: string;
    source_id: string;
    body: SourcePatch;
}
export function updateSource(http: HttpClient, rootUrl: string, params: UpdateSource$Params, context?: HttpContext): Observable<StrictHttpResponse<SourceOut>> {
    const rb = new RequestBuilder(rootUrl, updateSource.PATH, 'patch');
    if (params) {
        rb.path('collection_id', params.collection_id, {});
        rb.path('source_id', params.source_id, {});
        rb.body(params.body, 'application/json');
    }
    return http.request(rb.build({ responseType: 'json', accept: 'application/json', context })).pipe(filter((r: any): r is HttpResponse<any> => r instanceof HttpResponse), map((r: HttpResponse<any>) => {
        return r as StrictHttpResponse<SourceOut>;
    }));
}
updateSource.PATH = '/api/v1/collections/{collection_id}/sources/{source_id}';
