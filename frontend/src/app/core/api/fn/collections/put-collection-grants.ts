import { HttpClient, HttpContext, HttpResponse } from '@angular/common/http';
import { Observable } from 'rxjs';
import { filter, map } from 'rxjs/operators';
import { StrictHttpResponse } from '../../strict-http-response';
import { RequestBuilder } from '../../request-builder';
import { GrantOut } from '../../models/grant-out';
import { GrantsUpdate } from '../../models/grants-update';
export interface PutCollectionGrants$Params {
    collection_id: string;
    body: GrantsUpdate;
}
export function putCollectionGrants(http: HttpClient, rootUrl: string, params: PutCollectionGrants$Params, context?: HttpContext): Observable<StrictHttpResponse<Array<GrantOut>>> {
    const rb = new RequestBuilder(rootUrl, putCollectionGrants.PATH, 'put');
    if (params) {
        rb.path('collection_id', params.collection_id, {});
        rb.body(params.body, 'application/json');
    }
    return http.request(rb.build({ responseType: 'json', accept: 'application/json', context })).pipe(filter((r: any): r is HttpResponse<any> => r instanceof HttpResponse), map((r: HttpResponse<any>) => {
        return r as StrictHttpResponse<Array<GrantOut>>;
    }));
}
putCollectionGrants.PATH = '/api/v1/collections/{collection_id}/grants';
