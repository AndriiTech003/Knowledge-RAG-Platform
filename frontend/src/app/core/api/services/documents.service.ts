import { HttpClient, HttpContext } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { BaseService } from '../base-service';
import { ApiConfiguration } from '../api-configuration';
import { StrictHttpResponse } from '../strict-http-response';
import { ChunkDetail } from '../models/chunk-detail';
import { createUploadUrl } from '../fn/documents/create-upload-url';
import { CreateUploadUrl$Params } from '../fn/documents/create-upload-url';
import { deleteDocument } from '../fn/documents/delete-document';
import { DeleteDocument$Params } from '../fn/documents/delete-document';
import { DocumentDetail } from '../models/document-detail';
import { documentEvents } from '../fn/documents/document-events';
import { DocumentEvents$Params } from '../fn/documents/document-events';
import { DocumentOut } from '../models/document-out';
import { DownloadUrl } from '../models/download-url';
import { getChunk } from '../fn/documents/get-chunk';
import { GetChunk$Params } from '../fn/documents/get-chunk';
import { getDocument } from '../fn/documents/get-document';
import { GetDocument$Params } from '../fn/documents/get-document';
import { getDownloadUrl } from '../fn/documents/get-download-url';
import { GetDownloadUrl$Params } from '../fn/documents/get-download-url';
import { listDocumentChunks } from '../fn/documents/list-document-chunks';
import { ListDocumentChunks$Params } from '../fn/documents/list-document-chunks';
import { listDocuments } from '../fn/documents/list-documents';
import { ListDocuments$Params } from '../fn/documents/list-documents';
import { PageChunkOut } from '../models/page-chunk-out';
import { PageDocumentOut } from '../models/page-document-out';
import { registerDocument } from '../fn/documents/register-document';
import { RegisterDocument$Params } from '../fn/documents/register-document';
import { reindexDocument } from '../fn/documents/reindex-document';
import { ReindexDocument$Params } from '../fn/documents/reindex-document';
import { UploadUrlResponse } from '../models/upload-url-response';
@Injectable({ providedIn: 'root' })
export class DocumentsService extends BaseService {
    constructor(config: ApiConfiguration, http: HttpClient) {
        super(config, http);
    }
    static readonly CreateUploadUrlPath = '/api/v1/collections/{collection_id}/documents/upload-url';
    createUploadUrl$Response(params: CreateUploadUrl$Params, context?: HttpContext): Observable<StrictHttpResponse<UploadUrlResponse>> {
        const obs = createUploadUrl(this.http, this.rootUrl, params, context);
        return obs;
    }
    createUploadUrl(params: CreateUploadUrl$Params, context?: HttpContext): Observable<UploadUrlResponse> {
        const resp = this.createUploadUrl$Response(params, context);
        return resp.pipe(map((r: StrictHttpResponse<UploadUrlResponse>): UploadUrlResponse => r.body));
    }
    static readonly ListDocumentsPath = '/api/v1/collections/{collection_id}/documents';
    listDocuments$Response(params: ListDocuments$Params, context?: HttpContext): Observable<StrictHttpResponse<PageDocumentOut>> {
        const obs = listDocuments(this.http, this.rootUrl, params, context);
        return obs;
    }
    listDocuments(params: ListDocuments$Params, context?: HttpContext): Observable<PageDocumentOut> {
        const resp = this.listDocuments$Response(params, context);
        return resp.pipe(map((r: StrictHttpResponse<PageDocumentOut>): PageDocumentOut => r.body));
    }
    static readonly RegisterDocumentPath = '/api/v1/collections/{collection_id}/documents';
    registerDocument$Response(params: RegisterDocument$Params, context?: HttpContext): Observable<StrictHttpResponse<DocumentOut>> {
        const obs = registerDocument(this.http, this.rootUrl, params, context);
        return obs;
    }
    registerDocument(params: RegisterDocument$Params, context?: HttpContext): Observable<DocumentOut> {
        const resp = this.registerDocument$Response(params, context);
        return resp.pipe(map((r: StrictHttpResponse<DocumentOut>): DocumentOut => r.body));
    }
    static readonly DocumentEventsPath = '/api/v1/documents/events';
    documentEvents$Response(params?: DocumentEvents$Params, context?: HttpContext): Observable<StrictHttpResponse<void>> {
        const obs = documentEvents(this.http, this.rootUrl, params, context);
        return obs;
    }
    documentEvents(params?: DocumentEvents$Params, context?: HttpContext): Observable<void> {
        const resp = this.documentEvents$Response(params, context);
        return resp.pipe(map((r: StrictHttpResponse<void>): void => r.body));
    }
    static readonly GetDocumentPath = '/api/v1/documents/{document_id}';
    getDocument$Response(params: GetDocument$Params, context?: HttpContext): Observable<StrictHttpResponse<DocumentDetail>> {
        const obs = getDocument(this.http, this.rootUrl, params, context);
        return obs;
    }
    getDocument(params: GetDocument$Params, context?: HttpContext): Observable<DocumentDetail> {
        const resp = this.getDocument$Response(params, context);
        return resp.pipe(map((r: StrictHttpResponse<DocumentDetail>): DocumentDetail => r.body));
    }
    static readonly DeleteDocumentPath = '/api/v1/documents/{document_id}';
    deleteDocument$Response(params: DeleteDocument$Params, context?: HttpContext): Observable<StrictHttpResponse<void>> {
        const obs = deleteDocument(this.http, this.rootUrl, params, context);
        return obs;
    }
    deleteDocument(params: DeleteDocument$Params, context?: HttpContext): Observable<void> {
        const resp = this.deleteDocument$Response(params, context);
        return resp.pipe(map((r: StrictHttpResponse<void>): void => r.body));
    }
    static readonly GetDownloadUrlPath = '/api/v1/documents/{document_id}/download-url';
    getDownloadUrl$Response(params: GetDownloadUrl$Params, context?: HttpContext): Observable<StrictHttpResponse<DownloadUrl>> {
        const obs = getDownloadUrl(this.http, this.rootUrl, params, context);
        return obs;
    }
    getDownloadUrl(params: GetDownloadUrl$Params, context?: HttpContext): Observable<DownloadUrl> {
        const resp = this.getDownloadUrl$Response(params, context);
        return resp.pipe(map((r: StrictHttpResponse<DownloadUrl>): DownloadUrl => r.body));
    }
    static readonly ListDocumentChunksPath = '/api/v1/documents/{document_id}/chunks';
    listDocumentChunks$Response(params: ListDocumentChunks$Params, context?: HttpContext): Observable<StrictHttpResponse<PageChunkOut>> {
        const obs = listDocumentChunks(this.http, this.rootUrl, params, context);
        return obs;
    }
    listDocumentChunks(params: ListDocumentChunks$Params, context?: HttpContext): Observable<PageChunkOut> {
        const resp = this.listDocumentChunks$Response(params, context);
        return resp.pipe(map((r: StrictHttpResponse<PageChunkOut>): PageChunkOut => r.body));
    }
    static readonly ReindexDocumentPath = '/api/v1/documents/{document_id}/reindex';
    reindexDocument$Response(params: ReindexDocument$Params, context?: HttpContext): Observable<StrictHttpResponse<DocumentOut>> {
        const obs = reindexDocument(this.http, this.rootUrl, params, context);
        return obs;
    }
    reindexDocument(params: ReindexDocument$Params, context?: HttpContext): Observable<DocumentOut> {
        const resp = this.reindexDocument$Response(params, context);
        return resp.pipe(map((r: StrictHttpResponse<DocumentOut>): DocumentOut => r.body));
    }
    static readonly GetChunkPath = '/api/v1/chunks/{chunk_id}';
    getChunk$Response(params: GetChunk$Params, context?: HttpContext): Observable<StrictHttpResponse<ChunkDetail>> {
        const obs = getChunk(this.http, this.rootUrl, params, context);
        return obs;
    }
    getChunk(params: GetChunk$Params, context?: HttpContext): Observable<ChunkDetail> {
        const resp = this.getChunk$Response(params, context);
        return resp.pipe(map((r: StrictHttpResponse<ChunkDetail>): ChunkDetail => r.body));
    }
}
