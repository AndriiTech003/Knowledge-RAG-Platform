import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { api, ask, login, RUN_ID } from './helpers';

const COLLECTION = 'Engineering RFCs & Runbooks';
const FIXTURE = join(__dirname, 'fixtures', 'onboarding-checklist.pdf');
const createdDocuments: string[] = [];
const createdConversations: string[] = [];

test.afterAll(async () => {
  for (const id of createdDocuments) await api('alice', 'DELETE', `/documents/${id}`).catch(() => null);
  for (const id of createdConversations) await api('alice', 'DELETE', `/chat/conversations/${id}`).catch(() => null);
});

test('alice uploads a PDF, it becomes ready, and a cited answer opens the PDF on page 2', async ({ page }) => {
  const fileName = `onboarding-checklist-${RUN_ID}.pdf`;
  await login(page, 'alice', '/collections');

  await page.locator('[data-testid="collection-card"]', { hasText: COLLECTION }).click();
  await expect(page.getByTestId('collection-title')).toHaveText(COLLECTION);
  await expect(page.getByTestId('live-indicator')).toHaveText(/Live updates/);

  await page.getByTestId('file-input').setInputFiles({ name: fileName, mimeType: 'application/pdf', buffer: readFileSync(FIXTURE) });
  const upload = page.locator(`[data-testid="upload-item"][data-name="${fileName}"]`);
  await expect(upload).toHaveAttribute('data-status', 'done', { timeout: 60_000 });
  const documentId = await upload.getAttribute('data-document-id');
  expect(documentId).toBeTruthy();
  createdDocuments.push(documentId as string);

  const row = page.locator(`[data-testid="document-row"][data-document-id="${documentId}"]`);
  await expect(row).toBeVisible();
  await expect(row).toHaveAttribute('data-status', 'ready', { timeout: 120_000 });
  await expect(row.getByTestId('status-badge')).toHaveText('Ready');

  await page.getByTestId('nav-chat').click();
  await ask(page, 'What is the Zephyr onboarding badge code?');
  const answer = page.getByTestId('assistant-message').last();
  await expect(answer).toHaveAttribute('data-status', 'complete');
  await expect(answer).toContainText('ZX-4471');
  const conversationId = page.url().split('/chat/')[1];
  if (conversationId) createdConversations.push(conversationId);

  const chip = answer.getByRole('button', { name: /Source \d+, Zephyr Engineering Onboarding Checklist, p\. 2/ }).first();
  await expect(chip).toBeVisible();
  await chip.hover();
  await expect(page.getByTestId('citation-preview')).toContainText('ZX-4471');
  await chip.click();

  const panel = page.getByTestId('sources-panel');
  await expect(panel).toBeVisible();
  await expect(panel.getByTestId('source-detail')).toContainText('Zephyr Engineering Onboarding Checklist');
  const viewerPage = panel.getByTestId('viewer-page');
  await expect(viewerPage).toHaveAttribute('data-page', '2', { timeout: 60_000 });
  await expect(viewerPage).toContainText('Page 2 of 3');
  await expect(panel.locator('#pageNumber')).toHaveValue('2');
});
