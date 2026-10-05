import type { Meta, StoryObj } from '@storybook/angular';
import { expect, within } from 'storybook/test';
import { Skeleton } from './skeleton';

const meta: Meta<Skeleton> = {
  title: 'Shared/Skeleton',
  component: Skeleton,
  args: { lines: 3 },
  argTypes: { lines: { control: { type: 'range', min: 1, max: 12 } } },
};

export default meta;
type Story = StoryObj<Skeleton>;

export const ThreeLines: Story = {
  play: async ({ canvasElement }) => {
    const bar = within(canvasElement).getByRole('progressbar', { name: 'Loading' });
    await expect(bar).toHaveAttribute('aria-busy', 'true');
    await expect(bar.querySelectorAll('.skeleton__line')).toHaveLength(3);
  },
};

export const Paragraph: Story = {
  args: { lines: 8 },
  play: async ({ canvasElement }) => {
    const lines = canvasElement.querySelectorAll<HTMLElement>('.skeleton__line');
    await expect(lines).toHaveLength(8);
    await expect(lines[2].style.width).toBe('60%');
  },
};
