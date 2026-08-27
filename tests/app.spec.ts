import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { gzipSync } from 'node:zlib';

test('indexes, searches, reads, and exports the local sample', async ({ page }, testInfo) => {
  const consoleErrors: string[] = [];
  page.on('console', (message) => { if (message.type() === 'error') consoleErrors.push(message.text()); });
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Find the one email');
  await expect(page.locator('.privacy-pill')).toBeVisible();
  await page.getByRole('button', { name: 'Try a tiny sample' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toContainText('paper-trail-sample.mbox');
  await expect(page.locator('.archive-meta')).toContainText('2 messages');

  const search = page.getByLabel('Words in message');
  await search.fill('tiny local');
  await expect(page.getByText('1 of 2 messages')).toBeVisible();
  await page.getByRole('button', { name: /Your first recovered message/ }).click();
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Your first recovered message');
  await expect(page.getByText(/tiny local sample/)).toBeVisible();

  await page.getByRole('button', { name: /Back to results/ }).click();
  await page.getByLabel(/Select Your first recovered message/).check();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: /Export selected/ }).click();
  expect((await download).suggestedFilename()).toBe('paper-trail-sample.mbox-selection.zip');

  await page.getByRole('button', { name: /Your first recovered message/ }).click();

  const accessibility = await new AxeBuilder({ page }).analyze();
  expect(accessibility.violations.filter((item) => ['serious', 'critical'].includes(item.impact || ''))).toEqual([]);
  expect(consoleErrors).toEqual([]);

  if (testInfo.project.name === 'mobile') {
    await expect(page.locator('.message-sheet')).toHaveCSS('background-color', /rgb/);
  }
});

test('reloads its shell offline after service worker installation', async ({ page, context }) => {
  await page.goto('/');
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  if (!(await page.evaluate(() => Boolean(navigator.serviceWorker.controller)))) {
    await page.reload();
    await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller));
  }
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Find the one email');
  await page.evaluate(() => window.dispatchEvent(new Event('offline')));
  await expect(page.getByText(/Offline — local archives/)).toBeVisible();
});

test('streams and seeks a gzip MBOX without uploading', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'One engine pass is enough for the gzip path.');
  const mbox = 'From first@example.test Thu Jan 01 00:00:00 2026\r\nSubject: First gzip message\r\nFrom: First <first@example.test>\r\n\r\nOne.\r\nFrom second@example.test Fri Jan 02 00:00:00 2026\r\nSubject: Second gzip message\r\nFrom: Second <second@example.test>\r\n\r\nFound after a streamed seek.\r\n';
  await page.goto('/');
  await page.locator('#fileInput').setInputFiles({ name: 'takeout.mbox.gz', mimeType: 'application/gzip', buffer: gzipSync(mbox) });
  await expect(page.getByRole('heading', { level: 1 })).toContainText('takeout.mbox.gz');
  await page.getByRole('button', { name: /Second gzip message/ }).click();
  await expect(page.getByText(/Found after a streamed seek/)).toBeVisible();
});
