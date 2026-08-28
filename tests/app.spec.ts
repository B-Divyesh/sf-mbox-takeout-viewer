import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { readFile } from 'node:fs/promises';
import { appReleaseVersion } from '../scripts/release-sw.mjs';

async function openDemo(page: import('@playwright/test').Page): Promise<void> {
  await page.goto('/demo');
  await expect(page.getByText('Demo — sample data, nothing is saved')).toBeVisible();
  await expect(page.locator('.archive-meta')).toContainText('3 messages');
}

test('@claim:demo-isolation demo never opens the production database', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('real:sentinel', 'keep'));
  await openDemo(page);
  const storage = await page.evaluate(async () => ({ databases: (await indexedDB.databases()).map((item) => item.name), sentinel: localStorage.getItem('real:sentinel') }));
  expect(storage.databases).toContain('demo:paper-trail-index');
  expect(storage.databases).not.toContain('paper-trail-index');
  expect(storage.sentinel).toBe('keep');
  await page.getByRole('button', { name: 'Reset demo' }).click();
  await expect(page.locator('.archive-meta')).toContainText('3 messages');
  await page.getByRole('button', { name: 'Start for real' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Search your Gmail Takeout archive');
  const namesAfterExit = await page.evaluate(async () => (await indexedDB.databases()).map((item) => item.name));
  expect(namesAfterExit).not.toContain('demo:paper-trail-index');
});

test('@claim:local-network the demo sends no cross-origin requests', async ({ page }) => {
  const requests: string[] = []; page.on('request', (request) => requests.push(request.url()));
  await openDemo(page);
  await page.getByLabel('Words in message').fill('recovered');
  await expect(page.locator('.result-status')).toContainText('1 of 3 messages');
  await page.getByRole('button', { name: 'Your first recovered message' }).click();
  await expect(page.getByText(/Search for recovered/)).toBeVisible();
  expect(requests.every((url) => new URL(url).origin === new URL(page.url()).origin)).toBe(true);
});

test('@claim:message-reading the sample opens a message for reading', async ({ page }) => {
  await openDemo(page);
  await page.getByRole('button', { name: 'Your first recovered message' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Your first recovered message');
  await expect(page.getByText(/Search for recovered/)).toBeVisible();
});

test('@claim:archive-search search and attachment filters change the sample results', async ({ page }) => {
  await openDemo(page);
  await page.getByLabel('Words in message').fill('garden');
  await expect(page.locator('.result-status')).toContainText('1 of 3 messages');
  await expect(page.getByRole('button', { name: 'Garden project handoff' })).toBeVisible();
  await page.getByLabel('Has attachments').check();
  await expect(page.locator('.result-status')).toContainText('0 of 3 messages');
  await page.getByLabel('Search the trail').getByRole('button', { name: 'Clear filters' }).click();
  await page.getByLabel('Has attachments').check();
  await expect(page.getByRole('button', { name: 'Receipt from the archive' })).toBeVisible();
});

test('@claim:email-export the sample exports a selected original email', async ({ page }) => {
  await openDemo(page);
  await page.getByLabel('Select Your first recovered message').check();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: /Export selected/ }).click();
  expect((await download).suggestedFilename()).toBe('paper-trail-sample.mbox-selection.zip');
});

test('@claim:attachment-download the sample attachment downloads', async ({ page }) => {
  await openDemo(page);
  await page.getByRole('button', { name: 'Receipt from the archive' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Receipt from the archive');
  const download = page.waitForEvent('download');
  await page.getByRole('link', { name: /receipt-note\.txt/ }).click();
  expect((await download).suggestedFilename()).toBe('receipt-note.txt');
});

test('@claim:offline-reload the demo opens after its first visit while offline', async ({ page, context }) => {
  await openDemo(page);
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  if (!(await page.evaluate(() => Boolean(navigator.serviceWorker.controller)))) { await page.reload(); await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller)); }
  await context.setOffline(true); await page.goto('/demo');
  await expect(page.getByText('Demo — sample data, nothing is saved')).toBeVisible();
});

test('routes, focus, metadata, and the designed 404 work', async ({ page }) => {
  await page.goto('/?demo=1'); await expect(page).toHaveURL('/demo'); await expect(page.getByText('Demo — sample data, nothing is saved')).toBeVisible();
  await openDemo(page);
  await page.getByRole('button', { name: 'Your first recovered message' }).click();
  await expect(page).toHaveURL(/\/demo\/archive\/.+\/message\/0$/);
  await page.goBack(); await expect(page.locator('.workspace')).toBeVisible(); await expect(page.locator('main h1')).toBeFocused();
  await page.goto('/does-not-exist'); await expect(page.getByRole('heading', { level: 1 })).toHaveText('This paper trail ends here.'); await expect(page.locator('main')).toBeVisible();
  await page.goto('/privacy/'); await expect(page).toHaveTitle('Privacy — Paper Trail'); await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', /privacy/);
});

test('accessibility, first screen, and mobile layout', async ({ page }, testInfo) => {
  await page.goto('/'); await expect(page.getByRole('heading', { level: 1 })).toHaveText('Search your Gmail Takeout archive'); await expect(page.getByRole('link', { name: 'Try it with sample data' })).toBeVisible();
  const results = await new AxeBuilder({ page }).analyze(); expect(results.violations.filter((item) => ['serious', 'critical'].includes(item.impact || ''))).toEqual([]);
  if (testInfo.project.name === 'mobile') expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test('release cache and route configuration are present', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'one browser release check');
  const html = await readFile('dist/index.html', 'utf8'); const [worker, config] = await Promise.all([readFile('dist/sw.js', 'utf8'), readFile('dist/staticwebapp.config.json', 'utf8')]);
  const version = appReleaseVersion(html); expect(worker).toContain(`paper-trail-shell-${version}`); expect(worker).toContain("'/demo'"); expect(JSON.parse(config).navigationFallback.rewrite).toBe('/index.html');
  await page.goto('/demo'); await expect(page.locator('main')).toBeVisible();
});
