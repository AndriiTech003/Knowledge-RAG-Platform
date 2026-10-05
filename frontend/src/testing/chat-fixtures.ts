import { ChatSseEvent, MetaEventData } from '../app/features/chat/chat.models';

export const META: MetaEventData = {
  condensed: 'q3 marketing budget',
  sources: [
    { n: 1, title: 'Q3 2026 Operating Budget', page: 3, section: '5. Approved budget', chunk_id: 'c1', document_id: 'd1', score: 0.99 },
    { n: 2, title: 'Q3 2026 Operating Budget', page: 1, section: '1. Purpose', chunk_id: 'c2', document_id: 'd1', score: 0.9 },
  ],
  query_log_id: 'log-1',
  message_id: 'assistant-1',
  user_message_id: 'user-1',
  searched_collections: [{ id: 'col-fin', name: 'Finance Reports' }],
};

export const ANSWER_EVENTS: ChatSseEvent[] = [
  { event: 'meta', data: META },
  { event: 'token', data: { t: 'The budget is ' } },
  { event: 'token', data: { t: '$420,000 [1].' } },
  { event: 'citation', data: { n: 1 } },
  {
    event: 'done',
    data: {
      message_id: 'assistant-1',
      query_log_id: 'log-1',
      status: 'complete',
      content: 'The approved budget is $420,000 [1].',
      usage: { input_tokens: 100, output_tokens: 10, cost_usd: 0.001, model: 'fake-llm' },
      timings_ms: { total: 900 },
      citations: [
        {
          n: 1,
          chunk_id: 'c1',
          document_id: 'd1',
          title: 'Q3 2026 Operating Budget',
          section: '5. Approved budget',
          page: 3,
          page_end: 3,
          char_start: 10,
          char_end: 80,
          mime_type: 'application/pdf',
          score: 0.99,
          snippet: 'approved marketing budget',
        },
      ],
      warnings: [],
      uncited_claims: [],
    },
  },
];
