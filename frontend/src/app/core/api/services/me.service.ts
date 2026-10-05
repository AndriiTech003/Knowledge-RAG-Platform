import { HttpClient, HttpContext } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { BaseService } from '../base-service';
import { ApiConfiguration } from '../api-configuration';
import { StrictHttpResponse } from '../strict-http-response';
import { getMe } from '../fn/me/get-me';
import { GetMe$Params } from '../fn/me/get-me';
import { MeOut } from '../models/me-out';
@Injectable({ providedIn: 'root' })
export class MeService extends BaseService {
    constructor(config: ApiConfiguration, http: HttpClient) {
        super(config, http);
    }
    static readonly GetMePath = '/api/v1/me';
    getMe$Response(params?: GetMe$Params, context?: HttpContext): Observable<StrictHttpResponse<MeOut>> {
        const obs = getMe(this.http, this.rootUrl, params, context);
        return obs;
    }
    getMe(params?: GetMe$Params, context?: HttpContext): Observable<MeOut> {
        const resp = this.getMe$Response(params, context);
        return resp.pipe(map((r: StrictHttpResponse<MeOut>): MeOut => r.body));
    }
}
