import { ChangeDetectionStrategy, Component, inject, input, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { applicationConfig, moduleMetadata, type Meta, type StoryObj } from '@storybook/angular';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { ConfirmDialog, ConfirmDialogData, ConfirmService } from './confirm-dialog';

@Component({
  selector: 'kb-confirm-dialog-demo',
  imports: [MatButtonModule],
  template: `
    <button mat-stroked-button type="button" (click)="open()">Delete document</button>
    <p data-testid="confirm-result">{{ result() }}</p>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class ConfirmDialogDemo {
  private readonly confirmations = inject(ConfirmService);
  readonly destructive = input(true);
  protected readonly result = signal('waiting');

  protected open(): void {
    this.confirmations
      .confirm({
        title: 'Delete document?',
        message: 'The document, its chunks and embeddings will be removed from the collection.',
        confirmText: 'Delete',
        destructive: this.destructive(),
      })
      .subscribe((confirmed) => this.result.set(confirmed ? 'confirmed' : 'cancelled'));
  }
}

const inlineData: ConfirmDialogData = {
  title: 'Revoke access?',
  message: 'Members of the sales group will no longer see documents in this collection.',
  destructive: false,
};

const meta: Meta<ConfirmDialog> = {
  title: 'Shared/ConfirmDialog',
  component: ConfirmDialog,
};

export default meta;
type Story = StoryObj<ConfirmDialog>;

export const Inline: Story = {
  decorators: [
    applicationConfig({
      providers: [
        { provide: MAT_DIALOG_DATA, useValue: inlineData },
        { provide: MatDialogRef, useValue: { close: () => undefined } },
      ],
    }),
  ],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('Revoke access?')).toBeVisible();
    await expect(canvas.getByTestId('confirm-ok')).toHaveTextContent('Confirm');
    await expect(canvas.getByTestId('confirm-cancel')).toHaveTextContent('Cancel');
  },
};

export const OpenAndConfirm: Story = {
  decorators: [moduleMetadata({ imports: [ConfirmDialogDemo] })],
  render: () => ({ template: '<kb-confirm-dialog-demo />' }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const page = within(document.body);
    await userEvent.click(canvas.getByRole('button', { name: 'Delete document' }));
    const dialog = await page.findByRole('dialog');
    await expect(dialog).toHaveTextContent('Delete document?');
    await expect(page.getByTestId('confirm-ok').className).toContain('destructive');
    await userEvent.click(page.getByTestId('confirm-ok'));
    await waitFor(() => expect(canvas.getByTestId('confirm-result')).toHaveTextContent('confirmed'));
  },
};

export const OpenAndCancel: Story = {
  decorators: [moduleMetadata({ imports: [ConfirmDialogDemo] })],
  render: () => ({ template: '<kb-confirm-dialog-demo />' }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Delete document' }));
    await userEvent.click(await within(document.body).findByTestId('confirm-cancel'));
    await waitFor(() => expect(canvas.getByTestId('confirm-result')).toHaveTextContent('cancelled'));
  },
};
