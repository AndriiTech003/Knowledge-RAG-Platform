import { HttpClient, HttpContext, HttpResponse } from '@angular/common/http';
import { Observable } from 'rxjs';
import { filter, map } from 'rxjs/operators';
import { StrictHttpResponse } from '../../strict-http-response';
import { RequestBuilder } from '../../request-builder';
import { DocumentOut } from '../../models/document-out';
import { DocumentRegister } from '../../models/document-register';
export interface RegisterDocument$Params {
    collection_id: string;
    body: DocumentRegister;
}
export function registerDocument(http: HttpClient, rootUrl: string, params: RegisterDocument$Params, context?: HttpContext): Observable<StrictHttpResponse<DocumentOut>> {
    const rb = new RequestBuilder(rootUrl, registerDocument.PATH, 'post');
    if (params) {
        rb.path('collection_id', params.collection_id, {});
        rb.body(params.body, 'application/json');
    }
    return http.request(rb.build({ responseType: 'json', accept: 'application/json', context })).pipe(filter((r: any): r is HttpResponse<any> => r instanceof HttpResponse), map((r: HttpResponse<any>) => {
        return r as StrictHttpResponse<DocumentOut>;
    }));
}
registerDocument.PATH = '/api/v1/collections/{collection_id}/documents';
