import { MatButtonModule } from '@angular/material/button';
import { moduleMetadata, type Meta, type StoryObj } from '@storybook/angular';
import { expect, within } from 'storybook/test';
import { EmptyState } from './empty-state';

const meta: Meta<EmptyState> = {
  title: 'Shared/EmptyState',
  component: EmptyState,
  decorators: [moduleMetadata({ imports: [MatButtonModule] })],
  args: { icon: 'inbox', title: 'No documents yet', message: null, testId: 'empty-state' },
};

export default meta;
type Story = StoryObj<EmptyState>;

export const TitleOnly: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('heading', { name: 'No documents yet' })).toBeVisible();
    await expect(canvasElement.querySelector('p')).toBeNull();
  },
};

export const WithMessage: Story = {
  args: {
    icon: 'search_off',
    title: 'No results',
    message: 'Nothing in the collections you can access matches this query. Try another wording or switch to lexical mode.',
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/Nothing in the collections/)).toBeVisible();
  },
};

export const WithAction: Story = {
  args: { icon: 'forum', title: 'Start a conversation', message: 'Ask anything about Northwind policies, RFCs or handbooks.' },
  render: (args) => ({
    props: args,
    template: `<kb-empty-state [icon]="icon" [title]="title" [message]="message" [testId]="testId">
      <button mat-flat-button type="button">New chat</button>
    </kb-empty-state>`,
  }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('button', { name: 'New chat' })).toBeVisible();
  },
};
