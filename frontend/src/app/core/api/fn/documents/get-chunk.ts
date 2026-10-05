import { HttpClient, HttpContext, HttpResponse } from '@angular/common/http';
import { Observable } from 'rxjs';
import { filter, map } from 'rxjs/operators';
import { StrictHttpResponse } from '../../strict-http-response';
import { RequestBuilder } from '../../request-builder';
import { ChunkDetail } from '../../models/chunk-detail';
export interface GetChunk$Params {
    chunk_id: string;
}
export function getChunk(http: HttpClient, rootUrl: string, params: GetChunk$Params, context?: HttpContext): Observable<StrictHttpResponse<ChunkDetail>> {
    const rb = new RequestBuilder(rootUrl, getChunk.PATH, 'get');
    if (params) {
        rb.path('chunk_id', params.chunk_id, {});
    }
    return http.request(rb.build({ responseType: 'json', accept: 'application/json', context })).pipe(filter((r: any): r is HttpResponse<any> => r instanceof HttpResponse), map((r: HttpResponse<any>) => {
        return r as StrictHttpResponse<ChunkDetail>;
    }));
}
getChunk.PATH = '/api/v1/chunks/{chunk_id}';
