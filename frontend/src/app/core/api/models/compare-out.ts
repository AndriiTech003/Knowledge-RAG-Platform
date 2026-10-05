import { CompareRow } from '../models/compare-row';
import { EvalRunOut } from '../models/eval-run-out';
export interface CompareOut {
    a: EvalRunOut;
    b: EvalRunOut;
    deltas: {
        [key: string]: number;
    };
    rows: Array<CompareRow>;
    summary: {
        [key: string]: number;
    };
}
