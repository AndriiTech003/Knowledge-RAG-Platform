import { HttpClient, HttpContext, HttpResponse } from '@angular/common/http';
import { Observable } from 'rxjs';
import { filter, map } from 'rxjs/operators';
import { StrictHttpResponse } from '../../strict-http-response';
import { RequestBuilder } from '../../request-builder';
import { SourceCreate } from '../../models/source-create';
import { SourceOut } from '../../models/source-out';
export interface CreateSource$Params {
    collection_id: string;
    body: SourceCreate;
}
export function createSource(http: HttpClient, rootUrl: string, params: CreateSource$Params, context?: HttpContext): Observable<StrictHttpResponse<SourceOut>> {
    const rb = new RequestBuilder(rootUrl, createSource.PATH, 'post');
    if (params) {
        rb.path('collection_id', params.collection_id, {});
        rb.body(params.body, 'application/json');
    }
    return http.request(rb.build({ responseType: 'json', accept: 'application/json', context })).pipe(filter((r: any): r is HttpResponse<any> => r instanceof HttpResponse), map((r: HttpResponse<any>) => {
        return r as StrictHttpResponse<SourceOut>;
    }));
}
createSource.PATH = '/api/v1/collections/{collection_id}/sources';
