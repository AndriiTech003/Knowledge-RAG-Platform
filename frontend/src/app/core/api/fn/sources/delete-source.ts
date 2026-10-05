import { HttpClient, HttpContext, HttpResponse } from '@angular/common/http';
import { Observable } from 'rxjs';
import { filter, map } from 'rxjs/operators';
import { StrictHttpResponse } from '../../strict-http-response';
import { RequestBuilder } from '../../request-builder';
export interface DeleteSource$Params {
    collection_id: string;
    source_id: string;
}
export function deleteSource(http: HttpClient, rootUrl: string, params: DeleteSource$Params, context?: HttpContext): Observable<StrictHttpResponse<void>> {
    const rb = new RequestBuilder(rootUrl, deleteSource.PATH, 'delete');
    if (params) {
        rb.path('collection_id', params.collection_id, {});
        rb.path('source_id', params.source_id, {});
    }
    return http.request(rb.build({ responseType: 'text', accept: '*/*', context })).pipe(filter((r: any): r is HttpResponse<any> => r instanceof HttpResponse), map((r: HttpResponse<any>) => {
        return (r as HttpResponse<any>).clone({ body: undefined }) as StrictHttpResponse<void>;
    }));
}
deleteSource.PATH = '/api/v1/collections/{collection_id}/sources/{source_id}';
