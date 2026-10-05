import { HttpClient, HttpContext } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { BaseService } from '../base-service';
import { ApiConfiguration } from '../api-configuration';
import { StrictHttpResponse } from '../strict-http-response';
import { search } from '../fn/search/search';
import { Search$Params } from '../fn/search/search';
import { SearchResponse } from '../models/search-response';
@Injectable({ providedIn: 'root' })
export class SearchService extends BaseService {
    constructor(config: ApiConfiguration, http: HttpClient) {
        super(config, http);
    }
    static readonly SearchPath = '/api/v1/search';
    search$Response(params: Search$Params, context?: HttpContext): Observable<StrictHttpResponse<SearchResponse>> {
        const obs = search(this.http, this.rootUrl, params, context);
        return obs;
    }
    search(params: Search$Params, context?: HttpContext): Observable<SearchResponse> {
        const resp = this.search$Response(params, context);
        return resp.pipe(map((r: StrictHttpResponse<SearchResponse>): SearchResponse => r.body));
    }
}
