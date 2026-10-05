import { HttpClient, HttpContext, HttpResponse } from '@angular/common/http';
import { Observable } from 'rxjs';
import { filter, map } from 'rxjs/operators';
import { StrictHttpResponse } from '../../strict-http-response';
import { RequestBuilder } from '../../request-builder';
export interface DocumentEvents$Params {
}
export function documentEvents(http: HttpClient, rootUrl: string, params?: DocumentEvents$Params, context?: HttpContext): Observable<StrictHttpResponse<void>> {
    const rb = new RequestBuilder(rootUrl, documentEvents.PATH, 'get');
    if (params) {
    }
    return http.request(rb.build({ responseType: 'text', accept: '*/*', context })).pipe(filter((r: any): r is HttpResponse<any> => r instanceof HttpResponse), map((r: HttpResponse<any>) => {
        return (r as HttpResponse<any>).clone({ body: undefined }) as StrictHttpResponse<void>;
    }));
}
documentEvents.PATH = '/api/v1/documents/events';
