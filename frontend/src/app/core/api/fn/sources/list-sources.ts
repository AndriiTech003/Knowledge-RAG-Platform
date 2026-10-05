import { HttpClient, HttpContext, HttpResponse } from '@angular/common/http';
import { Observable } from 'rxjs';
import { filter, map } from 'rxjs/operators';
import { StrictHttpResponse } from '../../strict-http-response';
import { RequestBuilder } from '../../request-builder';
import { SourceOut } from '../../models/source-out';
export interface ListSources$Params {
    collection_id: string;
}
export function listSources(http: HttpClient, rootUrl: string, params: ListSources$Params, context?: HttpContext): Observable<StrictHttpResponse<Array<SourceOut>>> {
    const rb = new RequestBuilder(rootUrl, listSources.PATH, 'get');
    if (params) {
        rb.path('collection_id', params.collection_id, {});
    }
    return http.request(rb.build({ responseType: 'json', accept: 'application/json', context })).pipe(filter((r: any): r is HttpResponse<any> => r instanceof HttpResponse), map((r: HttpResponse<any>) => {
        return r as StrictHttpResponse<Array<SourceOut>>;
    }));
}
listSources.PATH = '/api/v1/collections/{collection_id}/sources';
