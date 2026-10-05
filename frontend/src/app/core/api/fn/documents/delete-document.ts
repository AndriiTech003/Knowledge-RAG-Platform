import { HttpClient, HttpContext, HttpResponse } from '@angular/common/http';
import { Observable } from 'rxjs';
import { filter, map } from 'rxjs/operators';
import { StrictHttpResponse } from '../../strict-http-response';
import { RequestBuilder } from '../../request-builder';
export interface DeleteDocument$Params {
    document_id: string;
}
export function deleteDocument(http: HttpClient, rootUrl: string, params: DeleteDocument$Params, context?: HttpContext): Observable<StrictHttpResponse<void>> {
    const rb = new RequestBuilder(rootUrl, deleteDocument.PATH, 'delete');
    if (params) {
        rb.path('document_id', params.document_id, {});
    }
    return http.request(rb.build({ responseType: 'text', accept: '*/*', context })).pipe(filter((r: any): r is HttpResponse<any> => r instanceof HttpResponse), map((r: HttpResponse<any>) => {
        return (r as HttpResponse<any>).clone({ body: undefined }) as StrictHttpResponse<void>;
    }));
}
deleteDocument.PATH = '/api/v1/documents/{document_id}';
