import type { Meta, StoryObj } from '@storybook/angular';
import { expect, waitFor, within } from 'storybook/test';
import { FileDropZone } from './file-drop-zone';

const meta: Meta<FileDropZone> = {
  title: 'Shared/FileDropZone',
  component: FileDropZone,
  args: { disabled: false },
  render: (args) => ({
    props: { ...args, picked: [] },
    template: `<kb-file-drop-zone [disabled]="disabled" [hint]="hint ?? null" (files)="picked = $event" />
      <ul data-testid="picked">
        @for (file of picked; track file.name) {
          <li>{{ file.name }}</li>
        }
      </ul>`,
  }),
};

export default meta;
type Story = StoryObj<FileDropZone>;

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('Drag & drop files here')).toBeVisible();
    await expect(canvas.getByText('PDF, DOCX, Markdown, HTML or plain text')).toBeVisible();
    const input = canvas.getByTestId<HTMLInputElement>('file-input');
    const transfer = new DataTransfer();
    transfer.items.add(new File(['# Handbook'], 'handbook.md', { type: 'text/markdown' }));
    input.files = transfer.files;
    input.dispatchEvent(new Event('change', { bubbles: true }));
    await waitFor(() => expect(canvas.getByTestId('picked')).toHaveTextContent('handbook.md'));
    await expect(input.value).toBe('');
  },
};

export const DropFiles: Story = {
  play: async ({ canvasElement }) => {
    const zone = within(canvasElement).getByTestId('drop-zone');
    const transfer = new DataTransfer();
    transfer.items.add(new File(['a'], 'a.pdf', { type: 'application/pdf' }));
    transfer.items.add(new File(['b'], 'b.docx'));
    zone.dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer: transfer }));
    await waitFor(() => expect(zone.className).toContain('drop--over'));
    zone.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: transfer }));
    const picked = within(canvasElement).getByTestId('picked');
    await waitFor(() => expect(picked.querySelectorAll('li')).toHaveLength(2));
    await expect(picked).toHaveTextContent('a.pdf');
    await expect(picked).toHaveTextContent('b.docx');
    await waitFor(() => expect(zone.className).not.toContain('drop--over'));
  },
};

export const Disabled: Story = {
  args: { disabled: true, hint: 'You have read-only access to this collection' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('button', { name: 'Browse…' })).toBeDisabled();
    await expect(canvas.getByTestId('drop-zone').className).toContain('drop--disabled');
  },
};
