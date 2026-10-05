import { HttpClient, HttpContext, HttpResponse } from '@angular/common/http';
import { Observable } from 'rxjs';
import { filter, map } from 'rxjs/operators';
import { StrictHttpResponse } from '../../strict-http-response';
import { RequestBuilder } from '../../request-builder';
import { CollectionOut } from '../../models/collection-out';
export interface GetCollection$Params {
    collection_id: string;
}
export function getCollection(http: HttpClient, rootUrl: string, params: GetCollection$Params, context?: HttpContext): Observable<StrictHttpResponse<CollectionOut>> {
    const rb = new RequestBuilder(rootUrl, getCollection.PATH, 'get');
    if (params) {
        rb.path('collection_id', params.collection_id, {});
    }
    return http.request(rb.build({ responseType: 'json', accept: 'application/json', context })).pipe(filter((r: any): r is HttpResponse<any> => r instanceof HttpResponse), map((r: HttpResponse<any>) => {
        return r as StrictHttpResponse<CollectionOut>;
    }));
}
getCollection.PATH = '/api/v1/collections/{collection_id}';
