import { HttpClient, HttpContext } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { BaseService } from '../base-service';
import { ApiConfiguration } from '../api-configuration';
import { StrictHttpResponse } from '../strict-http-response';
import { CollectionOut } from '../models/collection-out';
import { createCollection } from '../fn/collections/create-collection';
import { CreateCollection$Params } from '../fn/collections/create-collection';
import { deleteCollection } from '../fn/collections/delete-collection';
import { DeleteCollection$Params } from '../fn/collections/delete-collection';
import { getCollection } from '../fn/collections/get-collection';
import { GetCollection$Params } from '../fn/collections/get-collection';
import { getCollectionGrants } from '../fn/collections/get-collection-grants';
import { GetCollectionGrants$Params } from '../fn/collections/get-collection-grants';
import { GrantOut } from '../models/grant-out';
import { listCollections } from '../fn/collections/list-collections';
import { ListCollections$Params } from '../fn/collections/list-collections';
import { PageCollectionOut } from '../models/page-collection-out';
import { putCollectionGrants } from '../fn/collections/put-collection-grants';
import { PutCollectionGrants$Params } from '../fn/collections/put-collection-grants';
import { updateCollection } from '../fn/collections/update-collection';
import { UpdateCollection$Params } from '../fn/collections/update-collection';
@Injectable({ providedIn: 'root' })
export class CollectionsService extends BaseService {
    constructor(config: ApiConfiguration, http: HttpClient) {
        super(config, http);
    }
    static readonly ListCollectionsPath = '/api/v1/collections';
    listCollections$Response(params?: ListCollections$Params, context?: HttpContext): Observable<StrictHttpResponse<PageCollectionOut>> {
        const obs = listCollections(this.http, this.rootUrl, params, context);
        return obs;
    }
    listCollections(params?: ListCollections$Params, context?: HttpContext): Observable<PageCollectionOut> {
        const resp = this.listCollections$Response(params, context);
        return resp.pipe(map((r: StrictHttpResponse<PageCollectionOut>): PageCollectionOut => r.body));
    }
    static readonly CreateCollectionPath = '/api/v1/collections';
    createCollection$Response(params: CreateCollection$Params, context?: HttpContext): Observable<StrictHttpResponse<CollectionOut>> {
        const obs = createCollection(this.http, this.rootUrl, params, context);
        return obs;
    }
    createCollection(params: CreateCollection$Params, context?: HttpContext): Observable<CollectionOut> {
        const resp = this.createCollection$Response(params, context);
        return resp.pipe(map((r: StrictHttpResponse<CollectionOut>): CollectionOut => r.body));
    }
    static readonly GetCollectionPath = '/api/v1/collections/{collection_id}';
    getCollection$Response(params: GetCollection$Params, context?: HttpContext): Observable<StrictHttpResponse<CollectionOut>> {
        const obs = getCollection(this.http, this.rootUrl, params, context);
        return obs;
    }
    getCollection(params: GetCollection$Params, context?: HttpContext): Observable<CollectionOut> {
        const resp = this.getCollection$Response(params, context);
        return resp.pipe(map((r: StrictHttpResponse<CollectionOut>): CollectionOut => r.body));
    }
    static readonly DeleteCollectionPath = '/api/v1/collections/{collection_id}';
    deleteCollection$Response(params: DeleteCollection$Params, context?: HttpContext): Observable<StrictHttpResponse<void>> {
        const obs = deleteCollection(this.http, this.rootUrl, params, context);
        return obs;
    }
    deleteCollection(params: DeleteCollection$Params, context?: HttpContext): Observable<void> {
        const resp = this.deleteCollection$Response(params, context);
        return resp.pipe(map((r: StrictHttpResponse<void>): void => r.body));
    }
    static readonly UpdateCollectionPath = '/api/v1/collections/{collection_id}';
    updateCollection$Response(params: UpdateCollection$Params, context?: HttpContext): Observable<StrictHttpResponse<CollectionOut>> {
        const obs = updateCollection(this.http, this.rootUrl, params, context);
        return obs;
    }
    updateCollection(params: UpdateCollection$Params, context?: HttpContext): Observable<CollectionOut> {
        const resp = this.updateCollection$Response(params, context);
        return resp.pipe(map((r: StrictHttpResponse<CollectionOut>): CollectionOut => r.body));
    }
    static readonly GetCollectionGrantsPath = '/api/v1/collections/{collection_id}/grants';
    getCollectionGrants$Response(params: GetCollectionGrants$Params, context?: HttpContext): Observable<StrictHttpResponse<Array<GrantOut>>> {
        const obs = getCollectionGrants(this.http, this.rootUrl, params, context);
        return obs;
    }
    getCollectionGrants(params: GetCollectionGrants$Params, context?: HttpContext): Observable<Array<GrantOut>> {
        const resp = this.getCollectionGrants$Response(params, context);
        return resp.pipe(map((r: StrictHttpResponse<Array<GrantOut>>): Array<GrantOut> => r.body));
    }
    static readonly PutCollectionGrantsPath = '/api/v1/collections/{collection_id}/grants';
    putCollectionGrants$Response(params: PutCollectionGrants$Params, context?: HttpContext): Observable<StrictHttpResponse<Array<GrantOut>>> {
        const obs = putCollectionGrants(this.http, this.rootUrl, params, context);
        return obs;
    }
    putCollectionGrants(params: PutCollectionGrants$Params, context?: HttpContext): Observable<Array<GrantOut>> {
        const resp = this.putCollectionGrants$Response(params, context);
        return resp.pipe(map((r: StrictHttpResponse<Array<GrantOut>>): Array<GrantOut> => r.body));
    }
}
