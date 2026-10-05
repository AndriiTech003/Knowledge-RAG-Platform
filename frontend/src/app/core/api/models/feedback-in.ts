export interface FeedbackIn {
    comment?: (string | null);
    rating: -1 | 1;
    reason?: ('wrong' | 'incomplete' | 'no_citation' | 'outdated' | 'other' | null);
}
