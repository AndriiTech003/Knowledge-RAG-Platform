import { render, screen, within } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { provideMarkdown, SANITIZE } from 'ngx-markdown';
import { of } from 'rxjs';
import { ANSWER_EVENTS, META } from '../../../testing/chat-fixtures';
import { ChunkPreviewService } from '../../shared/ui/chunk-preview.service';
import { applySseEvent, initialDraft } from './chat-events';
import { sanitizeMarkdownHtml } from './chat.routes';
import { ChatMessage } from './chat.models';
import { ChatThread, CitationOpenEvent } from './chat-thread';

function answered(): ChatMessage[] {
  const draft = ANSWER_EVENTS.reduce(applySseEvent, initialDraft('What was the budget?'));
  return [draft.user, draft.assistant];
}

const providers = [
  provideMarkdown({ sanitize: { provide: SANITIZE, useValue: sanitizeMarkdownHtml } }),
  { provide: ChunkPreviewService, useValue: { get: () => of(null) } },
];

describe('ChatThread', () => {
  it('renders [n] markers in the answer as citation chips', async () => {
    await render(ChatThread, { inputs: { messages: answered() }, providers });
    const chips = await screen.findAllByTestId('citation-chip');
    expect(chips).toHaveLength(1);
    expect(chips[0]).toHaveTextContent('1');
    expect(chips[0]).toHaveAccessibleName('Source 1, Q3 2026 Operating Budget, p. 3');
    expect(screen.getByTestId('assistant-message')).toHaveTextContent('The approved budget is $420,000');
    expect(screen.getByTestId('searched-for')).toHaveTextContent('Searched for: “q3 marketing budget”');
  });

  it('emits citationOpened with the message id and source number on chip click', async () => {
    const opened: CitationOpenEvent[] = [];
    await render(ChatThread, { inputs: { messages: answered() }, on: { citationOpened: (e: CitationOpenEvent) => opened.push(e) }, providers });
    await userEvent.click(await screen.findByTestId('citation-chip'));
    expect(opened).toEqual([{ messageId: 'assistant-1', n: 1 }]);
  });

  it('shows the no-answer card with the collections that were searched', async () => {
    const draft = [
      { event: 'meta' as const, data: { ...META, sources: [] } },
      { event: 'no_answer' as const, data: { reason: 'low_relevance', best_score: 0.02 } },
    ].reduce(applySseEvent, initialDraft('Budget?'));
    await render(ChatThread, { inputs: { messages: [draft.user, { ...draft.assistant, status: 'no_answer' }] }, providers });
    const card = screen.getByTestId('no-answer-card');
    expect(card).toHaveTextContent('Not found in the documents available to you');
    expect(within(card).getByTestId('no-answer-collections')).toHaveTextContent('Finance Reports');
  });

  it('underlines uncited claims and lists warnings', async () => {
    const [user, assistant] = answered();
    const message: ChatMessage = { ...assistant, content: 'Cited fact [1]. Unsupported statement here.', uncitedClaims: ['Unsupported statement here.'], warnings: ['uncited_claim'] };
    const { container } = await render(ChatThread, { inputs: { messages: [user, message] }, providers });
    await screen.findByTestId('citation-chip');
    const underlined = container.querySelector('.kb-uncited');
    expect(underlined).toHaveTextContent('Unsupported statement here.');
    expect(underlined).toHaveAttribute('data-tip', 'No source supports this statement');
    expect(screen.getByTestId('message-warnings')).toHaveTextContent('not backed by a cited source');
  });

  it('shows feedback already given on reloaded answers', async () => {
    const [user, assistant] = answered();
    await render(ChatThread, { inputs: { messages: [user, { ...assistant, feedback: -1 }] }, providers });
    expect(screen.getByTestId('feedback-down')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('feedback-down')).toBeDisabled();
    expect(screen.getByTestId('feedback-up')).toBeDisabled();
    expect(screen.getByRole('status', { name: '' })).toHaveTextContent('Thanks for the feedback');
  });

  it('shows an error card for failed generations', async () => {
    const [user, assistant] = answered();
    await render(ChatThread, { inputs: { messages: [user, { ...assistant, content: '', status: 'error', errorCode: 'LLM_UNAVAILABLE' }] }, providers });
    expect(screen.getByTestId('message-error')).toHaveTextContent('temporarily unavailable');
  });
});
