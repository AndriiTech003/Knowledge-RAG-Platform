import { HttpClient, HttpContext, HttpResponse } from '@angular/common/http';
import { Observable } from 'rxjs';
import { filter, map } from 'rxjs/operators';
import { StrictHttpResponse } from '../../strict-http-response';
import { RequestBuilder } from '../../request-builder';
import { UploadUrlRequest } from '../../models/upload-url-request';
import { UploadUrlResponse } from '../../models/upload-url-response';
export interface CreateUploadUrl$Params {
    collection_id: string;
    body: UploadUrlRequest;
}
export function createUploadUrl(http: HttpClient, rootUrl: string, params: CreateUploadUrl$Params, context?: HttpContext): Observable<StrictHttpResponse<UploadUrlResponse>> {
    const rb = new RequestBuilder(rootUrl, createUploadUrl.PATH, 'post');
    if (params) {
        rb.path('collection_id', params.collection_id, {});
        rb.body(params.body, 'application/json');
    }
    return http.request(rb.build({ responseType: 'json', accept: 'application/json', context })).pipe(filter((r: any): r is HttpResponse<any> => r instanceof HttpResponse), map((r: HttpResponse<any>) => {
        return r as StrictHttpResponse<UploadUrlResponse>;
    }));
}
createUploadUrl.PATH = '/api/v1/collections/{collection_id}/documents/upload-url';
