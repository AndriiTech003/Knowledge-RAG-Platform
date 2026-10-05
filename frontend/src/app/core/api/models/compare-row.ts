export interface CompareRow {
    a: ({
        [key: string]: any;
    } | null);
    b: ({
        [key: string]: any;
    } | null);
    change: 'improved' | 'worse' | 'unchanged' | 'new' | 'removed';
    delta: (number | null);
    question: (string | null);
    question_id: string;
    question_type: (string | null);
}
