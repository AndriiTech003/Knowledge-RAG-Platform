import { HttpClient, HttpContext } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { BaseService } from '../base-service';
import { ApiConfiguration } from '../api-configuration';
import { StrictHttpResponse } from '../strict-http-response';
import { compareEvalRuns } from '../fn/eval/compare-eval-runs';
import { CompareEvalRuns$Params } from '../fn/eval/compare-eval-runs';
import { CompareOut } from '../models/compare-out';
import { EvalRunDetail } from '../models/eval-run-detail';
import { EvalRunOut } from '../models/eval-run-out';
import { getEvalRun } from '../fn/eval/get-eval-run';
import { GetEvalRun$Params } from '../fn/eval/get-eval-run';
import { listEvalRuns } from '../fn/eval/list-eval-runs';
import { ListEvalRuns$Params } from '../fn/eval/list-eval-runs';
import { startEvalRun } from '../fn/eval/start-eval-run';
import { StartEvalRun$Params } from '../fn/eval/start-eval-run';
@Injectable({ providedIn: 'root' })
export class EvalService extends BaseService {
    constructor(config: ApiConfiguration, http: HttpClient) {
        super(config, http);
    }
    static readonly ListEvalRunsPath = '/api/v1/admin/eval/runs';
    listEvalRuns$Response(params?: ListEvalRuns$Params, context?: HttpContext): Observable<StrictHttpResponse<Array<EvalRunOut>>> {
        const obs = listEvalRuns(this.http, this.rootUrl, params, context);
        return obs;
    }
    listEvalRuns(params?: ListEvalRuns$Params, context?: HttpContext): Observable<Array<EvalRunOut>> {
        const resp = this.listEvalRuns$Response(params, context);
        return resp.pipe(map((r: StrictHttpResponse<Array<EvalRunOut>>): Array<EvalRunOut> => r.body));
    }
    static readonly StartEvalRunPath = '/api/v1/admin/eval/runs';
    startEvalRun$Response(params: StartEvalRun$Params, context?: HttpContext): Observable<StrictHttpResponse<EvalRunOut>> {
        const obs = startEvalRun(this.http, this.rootUrl, params, context);
        return obs;
    }
    startEvalRun(params: StartEvalRun$Params, context?: HttpContext): Observable<EvalRunOut> {
        const resp = this.startEvalRun$Response(params, context);
        return resp.pipe(map((r: StrictHttpResponse<EvalRunOut>): EvalRunOut => r.body));
    }
    static readonly GetEvalRunPath = '/api/v1/admin/eval/runs/{run_id}';
    getEvalRun$Response(params: GetEvalRun$Params, context?: HttpContext): Observable<StrictHttpResponse<EvalRunDetail>> {
        const obs = getEvalRun(this.http, this.rootUrl, params, context);
        return obs;
    }
    getEvalRun(params: GetEvalRun$Params, context?: HttpContext): Observable<EvalRunDetail> {
        const resp = this.getEvalRun$Response(params, context);
        return resp.pipe(map((r: StrictHttpResponse<EvalRunDetail>): EvalRunDetail => r.body));
    }
    static readonly CompareEvalRunsPath = '/api/v1/admin/eval/compare';
    compareEvalRuns$Response(params: CompareEvalRuns$Params, context?: HttpContext): Observable<StrictHttpResponse<CompareOut>> {
        const obs = compareEvalRuns(this.http, this.rootUrl, params, context);
        return obs;
    }
    compareEvalRuns(params: CompareEvalRuns$Params, context?: HttpContext): Observable<CompareOut> {
        const resp = this.compareEvalRuns$Response(params, context);
        return resp.pipe(map((r: StrictHttpResponse<CompareOut>): CompareOut => r.body));
    }
}
