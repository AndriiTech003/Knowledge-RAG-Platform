import { HttpClient, HttpContext } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { BaseService } from '../base-service';
import { ApiConfiguration } from '../api-configuration';
import { StrictHttpResponse } from '../strict-http-response';
import { FeedbackOut } from '../models/feedback-out';
import { sendFeedback } from '../fn/feedback/send-feedback';
import { SendFeedback$Params } from '../fn/feedback/send-feedback';
@Injectable({ providedIn: 'root' })
export class FeedbackService extends BaseService {
    constructor(config: ApiConfiguration, http: HttpClient) {
        super(config, http);
    }
    static readonly SendFeedbackPath = '/api/v1/chat/messages/{message_id}/feedback';
    sendFeedback$Response(params: SendFeedback$Params, context?: HttpContext): Observable<StrictHttpResponse<FeedbackOut>> {
        const obs = sendFeedback(this.http, this.rootUrl, params, context);
        return obs;
    }
    sendFeedback(params: SendFeedback$Params, context?: HttpContext): Observable<FeedbackOut> {
        const resp = this.sendFeedback$Response(params, context);
        return resp.pipe(map((r: StrictHttpResponse<FeedbackOut>): FeedbackOut => r.body));
    }
}
