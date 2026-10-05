import { HttpClient, HttpContext, HttpResponse } from '@angular/common/http';
import { Observable } from 'rxjs';
import { filter, map } from 'rxjs/operators';
import { StrictHttpResponse } from '../../strict-http-response';
import { RequestBuilder } from '../../request-builder';
import { PageCollectionOut } from '../../models/page-collection-out';
export interface ListCollections$Params {
    cursor?: (string | null);
    limit?: number;
}
export function listCollections(http: HttpClient, rootUrl: string, params?: ListCollections$Params, context?: HttpContext): Observable<StrictHttpResponse<PageCollectionOut>> {
    const rb = new RequestBuilder(rootUrl, listCollections.PATH, 'get');
    if (params) {
        rb.query('cursor', params.cursor, {});
        rb.query('limit', params.limit, {});
    }
    return http.request(rb.build({ responseType: 'json', accept: 'application/json', context })).pipe(filter((r: any): r is HttpResponse<any> => r instanceof HttpResponse), map((r: HttpResponse<any>) => {
        return r as StrictHttpResponse<PageCollectionOut>;
    }));
}
listCollections.PATH = '/api/v1/collections';
