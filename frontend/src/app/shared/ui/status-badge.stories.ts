import type { Meta, StoryObj } from '@storybook/angular';
import { expect, within } from 'storybook/test';
import { StatusBadge } from './status-badge';

const meta: Meta<StatusBadge> = {
  title: 'Shared/StatusBadge',
  component: StatusBadge,
  argTypes: {
    status: {
      control: 'select',
      options: ['queued', 'parsing', 'chunking', 'embedding', 'ready', 'failed', 'deleted', 'running', 'done', 'syncing', 'idle', 'error'],
    },
  },
};

export default meta;
type Story = StoryObj<StatusBadge>;

export const Ready: Story = {
  args: { status: 'ready' },
  play: async ({ canvasElement }) => {
    const badge = within(canvasElement).getByTestId('status-badge');
    await expect(badge).toHaveTextContent('Ready');
    await expect(badge).toHaveAttribute('data-status', 'ready');
    await expect(badge.className).toContain('badge--ok');
    await expect(badge.className).not.toContain('badge--active');
  },
};

export const Embedding: Story = {
  args: { status: 'embedding' },
  play: async ({ canvasElement }) => {
    const badge = within(canvasElement).getByTestId('status-badge');
    await expect(badge).toHaveTextContent('Embedding');
    await expect(badge.className).toContain('badge--active');
    await expect(badge.querySelector('.badge__pulse')).not.toBeNull();
  },
};

export const Failed: Story = {
  args: { status: 'failed' },
  play: async ({ canvasElement }) => {
    const badge = within(canvasElement).getByTestId('status-badge');
    await expect(badge).toHaveTextContent('Failed');
    await expect(badge.className).toContain('badge--error');
  },
};

export const UnknownStatus: Story = {
  args: { status: 'archived' },
  play: async ({ canvasElement }) => {
    const badge = within(canvasElement).getByTestId('status-badge');
    await expect(badge).toHaveTextContent('archived');
    await expect(badge.className).toContain('badge--neutral');
  },
};

export const IngestionLifecycle: Story = {
  render: () => ({
    props: { statuses: ['queued', 'parsing', 'chunking', 'embedding', 'ready', 'failed'] },
    template: `<div style="display: flex; gap: 8px; flex-wrap: wrap">
      @for (s of statuses; track s) {
        <kb-status-badge [status]="s" />
      }
    </div>`,
  }),
  play: async ({ canvasElement }) => {
    const badges = within(canvasElement).getAllByTestId('status-badge');
    await expect(badges).toHaveLength(6);
    await expect(badges.filter((b) => b.className.includes('badge--active'))).toHaveLength(4);
  },
};
