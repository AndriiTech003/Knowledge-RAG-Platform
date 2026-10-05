import { HttpClient, HttpContext, HttpResponse } from '@angular/common/http';
import { Observable } from 'rxjs';
import { filter, map } from 'rxjs/operators';
import { StrictHttpResponse } from '../../strict-http-response';
import { RequestBuilder } from '../../request-builder';
import { CollectionOut } from '../../models/collection-out';
import { CollectionPatch } from '../../models/collection-patch';
export interface UpdateCollection$Params {
    collection_id: string;
    body: CollectionPatch;
}
export function updateCollection(http: HttpClient, rootUrl: string, params: UpdateCollection$Params, context?: HttpContext): Observable<StrictHttpResponse<CollectionOut>> {
    const rb = new RequestBuilder(rootUrl, updateCollection.PATH, 'patch');
    if (params) {
        rb.path('collection_id', params.collection_id, {});
        rb.body(params.body, 'application/json');
    }
    return http.request(rb.build({ responseType: 'json', accept: 'application/json', context })).pipe(filter((r: any): r is HttpResponse<any> => r instanceof HttpResponse), map((r: HttpResponse<any>) => {
        return r as StrictHttpResponse<CollectionOut>;
    }));
}
updateCollection.PATH = '/api/v1/collections/{collection_id}';
