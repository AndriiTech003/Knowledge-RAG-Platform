import { HttpClient, HttpContext, HttpResponse } from '@angular/common/http';
import { Observable } from 'rxjs';
import { filter, map } from 'rxjs/operators';
import { StrictHttpResponse } from '../../strict-http-response';
import { RequestBuilder } from '../../request-builder';
export interface DeleteConversation$Params {
    conversation_id: string;
}
export function deleteConversation(http: HttpClient, rootUrl: string, params: DeleteConversation$Params, context?: HttpContext): Observable<StrictHttpResponse<void>> {
    const rb = new RequestBuilder(rootUrl, deleteConversation.PATH, 'delete');
    if (params) {
        rb.path('conversation_id', params.conversation_id, {});
    }
    return http.request(rb.build({ responseType: 'text', accept: '*/*', context })).pipe(filter((r: any): r is HttpResponse<any> => r instanceof HttpResponse), map((r: HttpResponse<any>) => {
        return (r as HttpResponse<any>).clone({ body: undefined }) as StrictHttpResponse<void>;
    }));
}
deleteConversation.PATH = '/api/v1/chat/conversations/{conversation_id}';
