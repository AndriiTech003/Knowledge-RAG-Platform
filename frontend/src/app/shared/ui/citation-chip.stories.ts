import { applicationConfig, componentWrapperDecorator, type Meta, type StoryObj } from '@storybook/angular';
import { delay, of } from 'rxjs';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { ChunkDetail } from '../../core/api/models';
import { ChunkPreviewService } from './chunk-preview.service';
import { CitationChip } from './citation-chip';

const DETAIL: ChunkDetail = {
  id: 'chunk-1',
  document_id: 'doc-1',
  collection_id: 'col-1',
  document_title: 'Travel Policy',
  heading_path: ['Travel Policy', 'Per diem', 'Europe'],
  text: 'Employees travelling in Europe receive a per diem of €65 per day for meals and incidentals. Receipts are not required for the per diem.',
  page_start: 4,
  page_end: 4,
  char_start: 1200,
  char_end: 1350,
  content_hash: 'h',
  embedding_model: 'bge-small-en-v1.5',
  mime_type: 'application/pdf',
  ordinal: 7,
  token_count: 32,
};

const previews: Pick<ChunkPreviewService, 'get'> = {
  get: (id: string) => of(id === DETAIL.id ? DETAIL : null).pipe(delay(200)),
};

const meta: Meta<CitationChip> = {
  title: 'Shared/CitationChip',
  component: CitationChip,
  decorators: [
    applicationConfig({ providers: [{ provide: ChunkPreviewService, useValue: previews }] }),
    componentWrapperDecorator((story) => `<p style="max-width: 520px; margin-top: 160px">Employees in Europe receive €65 per day${story}.</p>`),
  ],
  render: (args) => ({
    props: { ...args, activated: null },
    template: `<kb-citation-chip [n]="n" [chunkId]="chunkId" [title]="title" [page]="page" [section]="section" [snippet]="snippet" [active]="active" (activate)="activated = $event" />
      <output data-testid="activated" style="display: block; margin-top: 8px">{{ activated === null ? '' : 'opened source ' + activated }}</output>`,
  }),
  args: { n: 1, chunkId: 'chunk-1', title: 'Travel Policy', page: 4, section: 'Per diem > Europe', snippet: null, active: false },
};

export default meta;
type Story = StoryObj<CitationChip>;

export const HoverPreview: Story = {
  play: async ({ canvasElement }) => {
    const chip = within(canvasElement).getByTestId('citation-chip');
    await expect(chip).toHaveAccessibleName('Source 1, Travel Policy, p. 4');
    await userEvent.hover(chip);
    const preview = await within(document.body).findByTestId('citation-preview');
    await waitFor(() => expect(preview).toHaveTextContent('per diem of €65 per day'));
    await expect(preview).toHaveTextContent('Per diem > Europe');
    await userEvent.click(chip);
    await waitFor(() => expect(within(canvasElement).getByTestId('activated')).toHaveTextContent('opened source 1'));
  },
};

export const Active: Story = {
  args: { n: 2, active: true },
  play: async ({ canvasElement }) => {
    const chip = within(canvasElement).getByTestId('citation-chip');
    await expect(chip).toHaveTextContent('2');
    await expect(chip.className).toContain('chip--active');
  },
};

export const SnippetOnly: Story = {
  args: { n: 3, chunkId: null, title: null, page: null, section: null, snippet: 'The <mark>guest network</mark> is called NW-Guest.' },
  play: async ({ canvasElement }) => {
    const chip = within(canvasElement).getByTestId('citation-chip');
    await expect(chip.className).toContain('chip--missing');
    chip.focus();
    const preview = await within(document.body).findByTestId('citation-preview');
    await expect(preview).toHaveTextContent('The guest network is called NW-Guest.');
    await expect(preview).toHaveTextContent('Source 3');
  },
};
