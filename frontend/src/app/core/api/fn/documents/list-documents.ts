import { HttpClient, HttpContext, HttpResponse } from '@angular/common/http';
import { Observable } from 'rxjs';
import { filter, map } from 'rxjs/operators';
import { StrictHttpResponse } from '../../strict-http-response';
import { RequestBuilder } from '../../request-builder';
import { PageDocumentOut } from '../../models/page-document-out';
export interface ListDocuments$Params {
    collection_id: string;
    status?: (string | null);
    mime?: (string | null);
    q?: (string | null);
    cursor?: (string | null);
    limit?: number;
}
export function listDocuments(http: HttpClient, rootUrl: string, params: ListDocuments$Params, context?: HttpContext): Observable<StrictHttpResponse<PageDocumentOut>> {
    const rb = new RequestBuilder(rootUrl, listDocuments.PATH, 'get');
    if (params) {
        rb.path('collection_id', params.collection_id, {});
        rb.query('status', params.status, {});
        rb.query('mime', params.mime, {});
        rb.query('q', params.q, {});
        rb.query('cursor', params.cursor, {});
        rb.query('limit', params.limit, {});
    }
    return http.request(rb.build({ responseType: 'json', accept: 'application/json', context })).pipe(filter((r: any): r is HttpResponse<any> => r instanceof HttpResponse), map((r: HttpResponse<any>) => {
        return r as StrictHttpResponse<PageDocumentOut>;
    }));
}
listDocuments.PATH = '/api/v1/collections/{collection_id}/documents';
