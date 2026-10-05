import { expect, test } from '@playwright/test';
import { newUserPage } from './helpers';

test('the language switcher translates the UI and the choice survives a reload', async ({ browser }) => {
  const { context, page } = await newUserPage(browser, 'admin', '/chat');
  await expect(page.getByTestId('nav-chat')).toContainText('Chat');
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');

  await page.getByTestId('language-menu').click();
  await page.getByTestId('language-uk').click();
  await expect(page.locator('html')).toHaveAttribute('lang', 'uk', { timeout: 30_000 });
  await expect(page.getByTestId('nav-chat')).toContainText('Чат');
  await expect(page.getByTestId('nav-search')).toContainText('Пошук');
  await expect(page.getByTestId('nav-collections')).toContainText('Колекції');
  await expect(page.getByTestId('nav-admin-overview')).toContainText('Огляд');
  await expect(page.getByTestId('composer-input')).toHaveAttribute('placeholder', /Поставте|Запитайте|Ставте/);
  await expect(page).toHaveTitle('Чат · Northwind KB');
  expect(await page.evaluate(() => localStorage.getItem('kb.locale'))).toBe('uk');

  await page.reload();
  await expect(page.getByTestId('nav-search')).toContainText('Пошук', { timeout: 30_000 });
  await page.getByTestId('nav-collections').click();
  await expect(page.getByRole('heading', { name: 'Колекції' })).toBeVisible();

  await page.getByTestId('language-menu').click();
  await page.getByTestId('language-en').click();
  await expect(page.locator('html')).toHaveAttribute('lang', 'en', { timeout: 30_000 });
  await expect(page.getByTestId('nav-search')).toContainText('Search');
  expect(await page.evaluate(() => localStorage.getItem('kb.locale'))).toBe('en');
  await context.close();
});
