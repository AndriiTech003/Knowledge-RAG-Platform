export interface EvalResultOut {
    answer: (string | null);
    judge_rationale: (string | null);
    metrics: ({
        [key: string]: any;
    } | null);
    question: (string | null);
    question_id: string;
    question_type: (string | null);
    retrieved_doc_ids: Array<string>;
}
