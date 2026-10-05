import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { UploadItem } from './documents.store';
import { UploadList } from './upload-list';

function item(patch: Partial<UploadItem>): UploadItem {
  return { id: 'u1', file: new File(['x'], 'a.pdf'), name: 'a.pdf', size: 2048, progress: 0, status: 'queued', error: null, documentId: null, newVersion: false, ...patch };
}

describe('UploadList', () => {
  it('shows progress for an upload in flight', async () => {
    await render(UploadList, { inputs: { items: [item({ status: 'uploading', progress: 42 })] } });
    expect(screen.getByTestId('upload-state')).toHaveTextContent('42%');
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '42');
    expect(screen.getByText('2 KB')).toBeInTheDocument();
  });

  it('shows the error message and lets the user retry', async () => {
    const retried: string[] = [];
    await render(UploadList, {
      inputs: { items: [item({ status: 'error', error: 'Upload failed: 403' })] },
      on: { retry: (id: string) => retried.push(id) },
    });
    expect(screen.getByTestId('upload-error')).toHaveTextContent('Upload failed: 403');
    await userEvent.click(screen.getByTestId('upload-retry'));
    expect(retried).toEqual(['u1']);
  });

  it('lets the user cancel a running upload', async () => {
    const cancelled: string[] = [];
    await render(UploadList, { inputs: { items: [item({ status: 'uploading', progress: 10 })] }, on: { cancelled: (id: string) => cancelled.push(id) } });
    await userEvent.click(screen.getByTestId('upload-cancel'));
    expect(cancelled).toEqual(['u1']);
  });

  it('labels new versions of existing documents', async () => {
    await render(UploadList, { inputs: { items: [item({ status: 'done', progress: 100, newVersion: true })] } });
    expect(screen.getByTestId('upload-state')).toHaveTextContent('Uploaded · new version');
  });
});
