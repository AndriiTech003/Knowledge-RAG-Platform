import { HttpClient, HttpContext, HttpResponse } from '@angular/common/http';
import { Observable } from 'rxjs';
import { filter, map } from 'rxjs/operators';
import { StrictHttpResponse } from '../../strict-http-response';
import { RequestBuilder } from '../../request-builder';
import { GrantOut } from '../../models/grant-out';
export interface GetCollectionGrants$Params {
    collection_id: string;
}
export function getCollectionGrants(http: HttpClient, rootUrl: string, params: GetCollectionGrants$Params, context?: HttpContext): Observable<StrictHttpResponse<Array<GrantOut>>> {
    const rb = new RequestBuilder(rootUrl, getCollectionGrants.PATH, 'get');
    if (params) {
        rb.path('collection_id', params.collection_id, {});
    }
    return http.request(rb.build({ responseType: 'json', accept: 'application/json', context })).pipe(filter((r: any): r is HttpResponse<any> => r instanceof HttpResponse), map((r: HttpResponse<any>) => {
        return r as StrictHttpResponse<Array<GrantOut>>;
    }));
}
getCollectionGrants.PATH = '/api/v1/collections/{collection_id}/grants';
