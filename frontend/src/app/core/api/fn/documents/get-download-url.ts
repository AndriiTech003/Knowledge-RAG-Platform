import { HttpClient, HttpContext, HttpResponse } from '@angular/common/http';
import { Observable } from 'rxjs';
import { filter, map } from 'rxjs/operators';
import { StrictHttpResponse } from '../../strict-http-response';
import { RequestBuilder } from '../../request-builder';
import { DownloadUrl } from '../../models/download-url';
export interface GetDownloadUrl$Params {
    document_id: string;
}
export function getDownloadUrl(http: HttpClient, rootUrl: string, params: GetDownloadUrl$Params, context?: HttpContext): Observable<StrictHttpResponse<DownloadUrl>> {
    const rb = new RequestBuilder(rootUrl, getDownloadUrl.PATH, 'get');
    if (params) {
        rb.path('document_id', params.document_id, {});
    }
    return http.request(rb.build({ responseType: 'json', accept: 'application/json', context })).pipe(filter((r: any): r is HttpResponse<any> => r instanceof HttpResponse), map((r: HttpResponse<any>) => {
        return r as StrictHttpResponse<DownloadUrl>;
    }));
}
getDownloadUrl.PATH = '/api/v1/documents/{document_id}/download-url';
