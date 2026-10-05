import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defaultConfig, desktopConfig, generateReport, navigation } from 'lighthouse';
import { chromium } from '@playwright/test';
import puppeteer from 'puppeteer-core';

const here = fileURLToPath(new URL('.', import.meta.url));
const base = (process.env.BASE_URL ?? 'http://127.0.0.1:4444').replace(/\/+$/, '');
const out = resolve(process.env.LIGHTHOUSE_OUT ?? resolve(here, '..', '..', 'docs', 'lighthouse'));
const password = process.env.E2E_PASSWORD ?? 'demo';
const categories = ['performance', 'accessibility', 'best-practices', 'seo'];

const pages = [
  { name: 'chat-desktop', user: 'alice', path: '/chat', config: desktopConfig },
  { name: 'search-desktop', user: 'alice', path: '/search', config: desktopConfig },
  { name: 'collections-desktop', user: 'alice', path: '/collections', config: desktopConfig },
  { name: 'admin-overview-desktop', user: 'admin', path: '/admin/overview', config: desktopConfig },
  { name: 'chat-uk-desktop', user: 'alice', path: '/chat', config: desktopConfig, locale: 'uk' },
  { name: 'chat-mobile', user: 'alice', path: '/chat', config: defaultConfig },
];

async function login(browser, user, locale) {
  const context = await browser.createBrowserContext();
  const page = await context.newPage();
  await page.goto(`${base}/chat`, { waitUntil: 'networkidle2' });
  await page.waitForSelector('#username', { timeout: 30_000 });
  await page.type('#username', user);
  await page.type('#password', password);
  await Promise.all([page.waitForNavigation({ waitUntil: 'networkidle2' }), page.click('#kc-login')]);
  await page.waitForFunction(() => document.querySelector('[data-testid="current-user"]')?.textContent?.trim(), { timeout: 30_000 });
  await page.evaluate((value) => localStorage.setItem('kb.locale', value), locale ?? 'en');
  return { context, page };
}

function summarize(name, path, lhr) {
  const audits = lhr.audits;
  const metric = (id) => audits[id]?.numericValue ?? null;
  return {
    name,
    path,
    formFactor: lhr.configSettings.formFactor,
    finalUrl: lhr.finalDisplayedUrl,
    scores: Object.fromEntries(categories.map((c) => [c, Math.round((lhr.categories[c]?.score ?? 0) * 100)])),
    metrics: {
      fcpMs: metric('first-contentful-paint'),
      lcpMs: metric('largest-contentful-paint'),
      tbtMs: metric('total-blocking-time'),
      cls: metric('cumulative-layout-shift'),
      speedIndexMs: metric('speed-index'),
      transferBytes: metric('total-byte-weight'),
    },
    failedAudits: Object.values(audits)
      .filter((a) => a.score !== null && a.score < 0.9 && a.scoreDisplayMode !== 'informative' && a.scoreDisplayMode !== 'manual' && a.scoreDisplayMode !== 'notApplicable')
      .map((a) => ({ id: a.id, title: a.title, score: a.score, displayValue: a.displayValue ?? null })),
  };
}

mkdirSync(out, { recursive: true });
const browser = await puppeteer.launch({
  executablePath: chromium.executablePath(),
  headless: true,
  args: ['--no-first-run', '--no-default-browser-check', '--disable-extensions', '--disable-component-update', '--disable-background-networking'],
  defaultViewport: null,
});
const results = [];
try {
  for (const target of pages) {
    const { context, page } = await login(browser, target.user, target.locale);
    const flags = { disableStorageReset: true, onlyCategories: categories, logLevel: 'error' };
    const runner = await navigation(page, `${base}${target.path}`, { config: target.config, flags });
    if (!runner?.lhr) throw new Error(`lighthouse returned no result for ${target.name}`);
    writeFileSync(resolve(out, `${target.name}.report.html`), generateReport(runner.lhr, 'html'));
    const summary = summarize(target.name, target.path, runner.lhr);
    results.push(summary);
    console.log(`${target.name}: ${categories.map((c) => `${c} ${summary.scores[c]}`).join(', ')}`);
    await context.close();
  }
} finally {
  await browser.close();
}

const ms = (v) => (v === null ? '—' : `${(v / 1000).toFixed(2)} s`);
const lines = [
  `| Page | Form factor | Performance | Accessibility | Best practices | SEO | FCP | LCP | TBT | CLS | Transfer |`,
  `|---|---|---|---|---|---|---|---|---|---|---|`,
  ...results.map(
    (r) =>
      `| ${r.name} (\`${r.path}\`) | ${r.formFactor} | ${r.scores.performance} | ${r.scores.accessibility} | ${r.scores['best-practices']} | ${r.scores.seo} | ${ms(r.metrics.fcpMs)} | ${ms(r.metrics.lcpMs)} | ${Math.round(r.metrics.tbtMs ?? 0)} ms | ${(r.metrics.cls ?? 0).toFixed(3)} | ${Math.round((r.metrics.transferBytes ?? 0) / 1024)} KiB |`,
  ),
];
writeFileSync(resolve(out, 'summary.json'), JSON.stringify({ generatedAt: new Date().toISOString(), base, results }, null, 2) + '\n');
writeFileSync(resolve(out, 'summary.md'), lines.join('\n') + '\n');
console.log(lines.join('\n'));
for (const r of results) {
  if (r.failedAudits.length) console.log(`\n${r.name} audits below 0.9:\n${r.failedAudits.map((a) => `  - ${a.id}: ${a.title}${a.displayValue ? ` (${a.displayValue})` : ''}`).join('\n')}`);
}
