import { Browser, BrowserContext, Page, expect } from '@playwright/test';

export const API_URL = (process.env.API_URL ?? 'http://127.0.0.1:4400').replace(/\/+$/, '');
export const OIDC_AUTHORITY = (process.env.OIDC_AUTHORITY ?? 'http://127.0.0.1:4480/realms/northwind').replace(/\/+$/, '');
export const OIDC_CLIENT_ID = process.env.OIDC_CLIENT_ID ?? 'kb-web';
export const PASSWORD = process.env.E2E_PASSWORD ?? 'demo';
export const RUN_ID = process.env.E2E_RUN_ID ?? `${Date.now().toString(36)}${Math.floor(Math.random() * 1e4).toString(36)}`;

export async function login(page: Page, username: string, path = '/chat'): Promise<void> {
  await page.goto(path);
  await page.locator('#username').waitFor({ timeout: 30_000 });
  await page.locator('#username').fill(username);
  await page.locator('#password').fill(PASSWORD);
  await page.locator('#kc-login').click();
  await expect(page.getByTestId('current-user')).not.toBeEmpty({ timeout: 30_000 });
}

export async function newUserPage(browser: Browser, username: string, path = '/chat'): Promise<{ context: BrowserContext; page: Page }> {
  const context = await browser.newContext();
  const page = await context.newPage();
  await login(page, username, path);
  return { context, page };
}

export async function apiToken(username: string): Promise<string> {
  const response = await fetch(`${OIDC_AUTHORITY}/protocol/openid-connect/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'password', client_id: OIDC_CLIENT_ID, username, password: PASSWORD, scope: 'openid' }),
  });
  if (!response.ok) throw new Error(`token request failed: ${response.status}`);
  return ((await response.json()) as { access_token: string }).access_token;
}

export async function api<T>(username: string, method: string, path: string, body?: unknown): Promise<T | null> {
  const token = await apiToken(username);
  const response = await fetch(`${API_URL}/api/v1${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (response.status === 204) return null;
  if (!response.ok) throw new Error(`${method} ${path} failed: ${response.status}`);
  return (await response.json()) as T;
}

export async function ask(page: Page, question: string): Promise<void> {
  await page.getByTestId('new-conversation').click();
  const input = page.getByTestId('composer-input');
  await input.fill(question);
  await input.press('Enter');
  await expect(page.getByTestId('user-message').last()).toHaveText(question);
  await expect(page.locator('[data-testid="assistant-message"]:not([data-status="streaming"])').last()).toBeVisible({ timeout: 90_000 });
}
