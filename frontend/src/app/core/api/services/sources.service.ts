import { HttpClient, HttpContext } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { BaseService } from '../base-service';
import { ApiConfiguration } from '../api-configuration';
import { StrictHttpResponse } from '../strict-http-response';
import { createSource } from '../fn/sources/create-source';
import { CreateSource$Params } from '../fn/sources/create-source';
import { deleteSource } from '../fn/sources/delete-source';
import { DeleteSource$Params } from '../fn/sources/delete-source';
import { listSourceJobs } from '../fn/sources/list-source-jobs';
import { ListSourceJobs$Params } from '../fn/sources/list-source-jobs';
import { listSources } from '../fn/sources/list-sources';
import { ListSources$Params } from '../fn/sources/list-sources';
import { SourceOut } from '../models/source-out';
import { SyncJobOut } from '../models/sync-job-out';
import { syncSource } from '../fn/sources/sync-source';
import { SyncSource$Params } from '../fn/sources/sync-source';
import { updateSource } from '../fn/sources/update-source';
import { UpdateSource$Params } from '../fn/sources/update-source';
@Injectable({ providedIn: 'root' })
export class SourcesService extends BaseService {
    constructor(config: ApiConfiguration, http: HttpClient) {
        super(config, http);
    }
    static readonly ListSourcesPath = '/api/v1/collections/{collection_id}/sources';
    listSources$Response(params: ListSources$Params, context?: HttpContext): Observable<StrictHttpResponse<Array<SourceOut>>> {
        const obs = listSources(this.http, this.rootUrl, params, context);
        return obs;
    }
    listSources(params: ListSources$Params, context?: HttpContext): Observable<Array<SourceOut>> {
        const resp = this.listSources$Response(params, context);
        return resp.pipe(map((r: StrictHttpResponse<Array<SourceOut>>): Array<SourceOut> => r.body));
    }
    static readonly CreateSourcePath = '/api/v1/collections/{collection_id}/sources';
    createSource$Response(params: CreateSource$Params, context?: HttpContext): Observable<StrictHttpResponse<SourceOut>> {
        const obs = createSource(this.http, this.rootUrl, params, context);
        return obs;
    }
    createSource(params: CreateSource$Params, context?: HttpContext): Observable<SourceOut> {
        const resp = this.createSource$Response(params, context);
        return resp.pipe(map((r: StrictHttpResponse<SourceOut>): SourceOut => r.body));
    }
    static readonly DeleteSourcePath = '/api/v1/collections/{collection_id}/sources/{source_id}';
    deleteSource$Response(params: DeleteSource$Params, context?: HttpContext): Observable<StrictHttpResponse<void>> {
        const obs = deleteSource(this.http, this.rootUrl, params, context);
        return obs;
    }
    deleteSource(params: DeleteSource$Params, context?: HttpContext): Observable<void> {
        const resp = this.deleteSource$Response(params, context);
        return resp.pipe(map((r: StrictHttpResponse<void>): void => r.body));
    }
    static readonly UpdateSourcePath = '/api/v1/collections/{collection_id}/sources/{source_id}';
    updateSource$Response(params: UpdateSource$Params, context?: HttpContext): Observable<StrictHttpResponse<SourceOut>> {
        const obs = updateSource(this.http, this.rootUrl, params, context);
        return obs;
    }
    updateSource(params: UpdateSource$Params, context?: HttpContext): Observable<SourceOut> {
        const resp = this.updateSource$Response(params, context);
        return resp.pipe(map((r: StrictHttpResponse<SourceOut>): SourceOut => r.body));
    }
    static readonly SyncSourcePath = '/api/v1/sources/{source_id}/sync';
    syncSource$Response(params: SyncSource$Params, context?: HttpContext): Observable<StrictHttpResponse<SourceOut>> {
        const obs = syncSource(this.http, this.rootUrl, params, context);
        return obs;
    }
    syncSource(params: SyncSource$Params, context?: HttpContext): Observable<SourceOut> {
        const resp = this.syncSource$Response(params, context);
        return resp.pipe(map((r: StrictHttpResponse<SourceOut>): SourceOut => r.body));
    }
    static readonly ListSourceJobsPath = '/api/v1/sources/{source_id}/jobs';
    listSourceJobs$Response(params: ListSourceJobs$Params, context?: HttpContext): Observable<StrictHttpResponse<Array<SyncJobOut>>> {
        const obs = listSourceJobs(this.http, this.rootUrl, params, context);
        return obs;
    }
    listSourceJobs(params: ListSourceJobs$Params, context?: HttpContext): Observable<Array<SyncJobOut>> {
        const resp = this.listSourceJobs$Response(params, context);
        return resp.pipe(map((r: StrictHttpResponse<Array<SyncJobOut>>): Array<SyncJobOut> => r.body));
    }
}
