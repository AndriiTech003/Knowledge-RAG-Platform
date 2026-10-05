import { HttpClient, HttpContext, HttpResponse } from '@angular/common/http';
import { Observable } from 'rxjs';
import { filter, map } from 'rxjs/operators';
import { StrictHttpResponse } from '../../strict-http-response';
import { RequestBuilder } from '../../request-builder';
import { MeOut } from '../../models/me-out';
export interface GetMe$Params {
}
export function getMe(http: HttpClient, rootUrl: string, params?: GetMe$Params, context?: HttpContext): Observable<StrictHttpResponse<MeOut>> {
    const rb = new RequestBuilder(rootUrl, getMe.PATH, 'get');
    if (params) {
    }
    return http.request(rb.build({ responseType: 'json', accept: 'application/json', context })).pipe(filter((r: any): r is HttpResponse<any> => r instanceof HttpResponse), map((r: HttpResponse<any>) => {
        return r as StrictHttpResponse<MeOut>;
    }));
}
getMe.PATH = '/api/v1/me';
