export type MessageStatus = 'streaming' | 'complete' | 'no_answer' | 'stopped' | 'error';
export type MessageRole = 'user' | 'assistant';
export type FeedbackReason = 'wrong' | 'incomplete' | 'no_citation' | 'outdated' | 'other';

export interface ChatSource {
  n: number;
  title: string;
  page: number | null;
  section: string | null;
  chunk_id: string;
  document_id: string;
  score: number | null;
}

export interface ChatCitation extends ChatSource {
  page_end: number | null;
  char_start: number | null;
  char_end: number | null;
  mime_type: string | null;
  snippet: string | null;
}

export interface CollectionRefLite {
  id: string;
  name: string;
}

export interface MetaEventData {
  condensed: string | null;
  sources: ChatSource[];
  query_log_id: string | null;
  message_id: string;
  user_message_id: string;
  searched_collections: CollectionRefLite[];
}

export interface TokenEventData {
  t: string;
}

export interface CitationEventData {
  n: number;
}

export interface NoAnswerEventData {
  reason: 'low_relevance' | 'no_access' | (string & {});
  best_score: number | null;
}

export interface ChatUsage {
  input_tokens: number;
  output_tokens: number;
  cost_usd: number;
  model: string;
}

export interface DoneEventData {
  message_id: string;
  query_log_id: string | null;
  status: Exclude<MessageStatus, 'streaming'>;
  content: string;
  usage?: ChatUsage | null;
  timings_ms?: Record<string, number> | null;
  citations?: ChatCitation[] | null;
  warnings?: string[] | null;
  uncited_claims?: string[] | null;
}

export interface ErrorEventData {
  code: string;
  message?: string;
}

export type ChatSseEvent =
  | { event: 'meta'; data: MetaEventData }
  | { event: 'token'; data: TokenEventData }
  | { event: 'citation'; data: CitationEventData }
  | { event: 'no_answer'; data: NoAnswerEventData }
  | { event: 'done'; data: DoneEventData }
  | { event: 'error'; data: ErrorEventData };

export interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  status: MessageStatus;
  createdAt: string;
  sources: ChatSource[];
  citations: ChatCitation[];
  citedNumbers: number[];
  condensed: string | null;
  searchedCollections: CollectionRefLite[];
  warnings: string[];
  uncitedClaims: string[];
  noAnswer: NoAnswerEventData | null;
  usage: ChatUsage | null;
  errorCode: string | null;
  queryLogId: string | null;
  feedback: 1 | -1 | null;
}

export interface StreamDraft {
  user: ChatMessage;
  assistant: ChatMessage;
}

export interface SourceRow extends ChatSource {
  cited: boolean;
  citation: ChatCitation | null;
}
