import { HttpClient, HttpContext } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { BaseService } from '../base-service';
import { ApiConfiguration } from '../api-configuration';
import { StrictHttpResponse } from '../strict-http-response';
import { healthLive } from '../fn/health/health-live';
import { HealthLive$Params } from '../fn/health/health-live';
import { healthReady } from '../fn/health/health-ready';
import { HealthReady$Params } from '../fn/health/health-ready';
@Injectable({ providedIn: 'root' })
export class HealthService extends BaseService {
    constructor(config: ApiConfiguration, http: HttpClient) {
        super(config, http);
    }
    static readonly HealthLivePath = '/health/live';
    healthLive$Response(params?: HealthLive$Params, context?: HttpContext): Observable<StrictHttpResponse<{
        [key: string]: string;
    }>> {
        const obs = healthLive(this.http, this.rootUrl, params, context);
        return obs;
    }
    healthLive(params?: HealthLive$Params, context?: HttpContext): Observable<{
        [key: string]: string;
    }> {
        const resp = this.healthLive$Response(params, context);
        return resp.pipe(map((r: StrictHttpResponse<{
            [key: string]: string;
        }>): {
            [key: string]: string;
        } => r.body));
    }
    static readonly HealthReadyPath = '/health/ready';
    healthReady$Response(params?: HealthReady$Params, context?: HttpContext): Observable<StrictHttpResponse<any>> {
        const obs = healthReady(this.http, this.rootUrl, params, context);
        return obs;
    }
    healthReady(params?: HealthReady$Params, context?: HttpContext): Observable<any> {
        const resp = this.healthReady$Response(params, context);
        return resp.pipe(map((r: StrictHttpResponse<any>): any => r.body));
    }
}
