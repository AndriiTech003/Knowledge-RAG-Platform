import { expect, test } from '@playwright/test';
import { api, ask, newUserPage } from './helpers';

const QUESTION = 'What was the approved marketing budget for Q3?';
const cleanup: { user: string; id: string }[] = [];

test.afterAll(async () => {
  for (const { user, id } of cleanup) await api(user, 'DELETE', `/chat/conversations/${id}`).catch(() => null);
});

test('carol gets a cited answer about the Q3 budget while bob gets the no-answer card', async ({ browser }) => {
  const carol = await newUserPage(browser, 'carol');
  await ask(carol.page, QUESTION);
  const carolAnswer = carol.page.getByTestId('assistant-message').last();
  await expect(carolAnswer).toHaveAttribute('data-status', 'complete');
  await expect(carolAnswer).toContainText('$420,000');
  await expect(carolAnswer.getByTestId('citation-chip').first()).toBeVisible();
  await expect(carolAnswer.getByTestId('no-answer-card')).toHaveCount(0);
  const carolId = carol.page.url().split('/chat/')[1];
  if (carolId) cleanup.push({ user: 'carol', id: carolId });
  await carol.context.close();

  const bob = await newUserPage(browser, 'bob');
  await ask(bob.page, QUESTION);
  const bobAnswer = bob.page.getByTestId('assistant-message').last();
  await expect(bobAnswer).toHaveAttribute('data-status', 'no_answer');
  const card = bobAnswer.getByTestId('no-answer-card');
  await expect(card).toBeVisible();
  await expect(card).toContainText('Not found in the documents available to you');
  await expect(card.getByTestId('no-answer-collections')).toContainText('Sales Playbooks');
  await expect(card).not.toContainText('Finance Reports');
  await expect(bobAnswer).not.toContainText('$420,000');
  await expect(bobAnswer.getByTestId('citation-chip')).toHaveCount(0);
  const bobId = bob.page.url().split('/chat/')[1];
  if (bobId) cleanup.push({ user: 'bob', id: bobId });
  await bob.context.close();
});
