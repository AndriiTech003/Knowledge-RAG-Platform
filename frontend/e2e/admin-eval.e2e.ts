import { Page, expect, test } from '@playwright/test';
import { login, RUN_ID } from './helpers';

async function startRun(page: Page, name: string, retrieval: 'Vector' | 'Hybrid', rerank: boolean): Promise<void> {
  await page.getByTestId('start-run-toggle').click();
  const form = page.getByTestId('start-run-form');
  await form.getByRole('combobox').first().click();
  await page.getByRole('option', { name: retrieval, exact: true }).click();
  const toggle = form.getByRole('switch', { name: 'Reranker' });
  if ((await toggle.getAttribute('aria-checked')) !== String(rerank)) await toggle.click();
  await page.getByTestId('run-limit').fill('10');
  await page.getByTestId('run-name').fill(name);
  await page.getByTestId('start-run-submit').click();
  await expect(page.locator(`[data-testid="eval-run-row"][data-name="${name}"]`)).toBeVisible();
}

test('admin starts retrieval eval runs, sees them finish and compares the two latest', async ({ page }) => {
  await login(page, 'admin', '/chat');
  await expect(page.getByTestId('admin-nav')).toBeVisible();
  await page.getByTestId('nav-admin-eval').click();
  await expect(page.getByTestId('eval-runs-table')).toBeVisible();

  const baseline = `e2e-${RUN_ID}-vector`;
  const candidate = `e2e-${RUN_ID}-hybrid`;
  await startRun(page, baseline, 'Vector', false);
  await expect(page.locator(`[data-testid="eval-run-row"][data-name="${baseline}"]`)).toHaveAttribute('data-status', 'done', { timeout: 180_000 });
  await startRun(page, candidate, 'Hybrid', true);
  const candidateRow = page.locator(`[data-testid="eval-run-row"][data-name="${candidate}"]`);
  await expect(candidateRow).toHaveAttribute('data-status', 'done', { timeout: 180_000 });
  await expect(candidateRow).toContainText('limit 10');

  await page.getByTestId('compare-latest').click();
  await expect(page).toHaveURL(/\/admin\/eval\/compare\?a=.+&b=.+/);
  const compare = page.getByTestId('eval-compare');
  await expect(compare).toContainText(baseline);
  await expect(compare).toContainText(candidate);
  await expect(page.getByTestId('compare-summary')).toContainText('improved');
  await expect(page.getByTestId('compare-row').first()).toBeVisible();
  const total = await page.getByTestId('compare-row').count();
  expect(total).toBeGreaterThanOrEqual(10);

  await page.getByTestId('compare-type-filter').click();
  const firstType = page.getByRole('option').nth(1);
  const typeName = (await firstType.textContent())?.trim() ?? '';
  await firstType.click();
  const filtered = page.getByTestId('compare-row');
  await expect(filtered.first()).toContainText(typeName);
  expect(await filtered.count()).toBeLessThanOrEqual(total);
});

test('non-admin users do not see the admin menu and are redirected away from admin routes', async ({ page }) => {
  await login(page, 'alice', '/chat');
  await expect(page.getByTestId('admin-nav')).toHaveCount(0);
  await page.goto('/admin/eval');
  await expect(page.getByTestId('forbidden')).toBeVisible();
});
