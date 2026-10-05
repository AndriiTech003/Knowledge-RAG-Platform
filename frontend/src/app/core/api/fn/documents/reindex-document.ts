import { HttpClient, HttpContext, HttpResponse } from '@angular/common/http';
import { Observable } from 'rxjs';
import { filter, map } from 'rxjs/operators';
import { StrictHttpResponse } from '../../strict-http-response';
import { RequestBuilder } from '../../request-builder';
import { DocumentOut } from '../../models/document-out';
export interface ReindexDocument$Params {
    document_id: string;
}
export function reindexDocument(http: HttpClient, rootUrl: string, params: ReindexDocument$Params, context?: HttpContext): Observable<StrictHttpResponse<DocumentOut>> {
    const rb = new RequestBuilder(rootUrl, reindexDocument.PATH, 'post');
    if (params) {
        rb.path('document_id', params.document_id, {});
    }
    return http.request(rb.build({ responseType: 'json', accept: 'application/json', context })).pipe(filter((r: any): r is HttpResponse<any> => r instanceof HttpResponse), map((r: HttpResponse<any>) => {
        return r as StrictHttpResponse<DocumentOut>;
    }));
}
reindexDocument.PATH = '/api/v1/documents/{document_id}/reindex';
