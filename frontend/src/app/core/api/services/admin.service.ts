import { HttpClient, HttpContext } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { BaseService } from '../base-service';
import { ApiConfiguration } from '../api-configuration';
import { StrictHttpResponse } from '../strict-http-response';
import { analyticsNegativeFeedback } from '../fn/admin/analytics-negative-feedback';
import { AnalyticsNegativeFeedback$Params } from '../fn/admin/analytics-negative-feedback';
import { analyticsOverview } from '../fn/admin/analytics-overview';
import { AnalyticsOverview$Params } from '../fn/admin/analytics-overview';
import { analyticsUnanswered } from '../fn/admin/analytics-unanswered';
import { AnalyticsUnanswered$Params } from '../fn/admin/analytics-unanswered';
import { getQueryLog } from '../fn/admin/get-query-log';
import { GetQueryLog$Params } from '../fn/admin/get-query-log';
import { listQueryLogs } from '../fn/admin/list-query-logs';
import { ListQueryLogs$Params } from '../fn/admin/list-query-logs';
import { NegativeFeedbackItem } from '../models/negative-feedback-item';
import { Overview } from '../models/overview';
import { QueryLogSummary } from '../models/query-log-summary';
import { QueryTrace } from '../models/query-trace';
import { UnansweredCluster } from '../models/unanswered-cluster';
@Injectable({ providedIn: 'root' })
export class AdminService extends BaseService {
    constructor(config: ApiConfiguration, http: HttpClient) {
        super(config, http);
    }
    static readonly AnalyticsOverviewPath = '/api/v1/admin/analytics/overview';
    analyticsOverview$Response(params?: AnalyticsOverview$Params, context?: HttpContext): Observable<StrictHttpResponse<Overview>> {
        const obs = analyticsOverview(this.http, this.rootUrl, params, context);
        return obs;
    }
    analyticsOverview(params?: AnalyticsOverview$Params, context?: HttpContext): Observable<Overview> {
        const resp = this.analyticsOverview$Response(params, context);
        return resp.pipe(map((r: StrictHttpResponse<Overview>): Overview => r.body));
    }
    static readonly AnalyticsUnansweredPath = '/api/v1/admin/analytics/unanswered';
    analyticsUnanswered$Response(params?: AnalyticsUnanswered$Params, context?: HttpContext): Observable<StrictHttpResponse<Array<UnansweredCluster>>> {
        const obs = analyticsUnanswered(this.http, this.rootUrl, params, context);
        return obs;
    }
    analyticsUnanswered(params?: AnalyticsUnanswered$Params, context?: HttpContext): Observable<Array<UnansweredCluster>> {
        const resp = this.analyticsUnanswered$Response(params, context);
        return resp.pipe(map((r: StrictHttpResponse<Array<UnansweredCluster>>): Array<UnansweredCluster> => r.body));
    }
    static readonly AnalyticsNegativeFeedbackPath = '/api/v1/admin/analytics/negative-feedback';
    analyticsNegativeFeedback$Response(params?: AnalyticsNegativeFeedback$Params, context?: HttpContext): Observable<StrictHttpResponse<Array<NegativeFeedbackItem>>> {
        const obs = analyticsNegativeFeedback(this.http, this.rootUrl, params, context);
        return obs;
    }
    analyticsNegativeFeedback(params?: AnalyticsNegativeFeedback$Params, context?: HttpContext): Observable<Array<NegativeFeedbackItem>> {
        const resp = this.analyticsNegativeFeedback$Response(params, context);
        return resp.pipe(map((r: StrictHttpResponse<Array<NegativeFeedbackItem>>): Array<NegativeFeedbackItem> => r.body));
    }
    static readonly ListQueryLogsPath = '/api/v1/admin/query-logs';
    listQueryLogs$Response(params?: ListQueryLogs$Params, context?: HttpContext): Observable<StrictHttpResponse<Array<QueryLogSummary>>> {
        const obs = listQueryLogs(this.http, this.rootUrl, params, context);
        return obs;
    }
    listQueryLogs(params?: ListQueryLogs$Params, context?: HttpContext): Observable<Array<QueryLogSummary>> {
        const resp = this.listQueryLogs$Response(params, context);
        return resp.pipe(map((r: StrictHttpResponse<Array<QueryLogSummary>>): Array<QueryLogSummary> => r.body));
    }
    static readonly GetQueryLogPath = '/api/v1/admin/query-logs/{query_log_id}';
    getQueryLog$Response(params: GetQueryLog$Params, context?: HttpContext): Observable<StrictHttpResponse<QueryTrace>> {
        const obs = getQueryLog(this.http, this.rootUrl, params, context);
        return obs;
    }
    getQueryLog(params: GetQueryLog$Params, context?: HttpContext): Observable<QueryTrace> {
        const resp = this.getQueryLog$Response(params, context);
        return resp.pipe(map((r: StrictHttpResponse<QueryTrace>): QueryTrace => r.body));
    }
}
