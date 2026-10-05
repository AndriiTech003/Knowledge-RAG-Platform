import { EvalResultOut } from '../models/eval-result-out';
export interface EvalRunDetail {
    config: {
        [key: string]: any;
    };
    dataset_version: (string | null);
    deltas?: {
        [key: string]: number;
    };
    error: (string | null);
    finished_at: (string | null);
    git_sha: (string | null);
    id: string;
    metrics: ({
        [key: string]: any;
    } | null);
    results: Array<EvalResultOut>;
    started_at: (string | null);
    status: string;
}
