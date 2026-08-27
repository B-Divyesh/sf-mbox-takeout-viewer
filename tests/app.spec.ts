import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { readFile, writeFile } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';
import { appReleaseVersion } from '../scripts/release-sw.mjs';

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
  await expect(page.getByRole('button', { name: /Your first recovered message/ })).toBeFocused();
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

test('sustains the 20 GiB indexing target on a deterministic 128 MiB MBOX', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'The verifier profile is desktop Chromium.');
  test.setTimeout(120_000);
  const mib = 1024 * 1024;
  const recordCount = 128;
  const header = 'From benchmark@example.test Thu Jan 01 00:00:00 2026\r\nSubject: Throughput record\r\nFrom: Benchmark <benchmark@example.test>\r\n\r\n';
  const words = Buffer.from('local archive search token ');
  const record = Buffer.alloc(mib, 0x20);
  record.write(header);
  for (let cursor = Buffer.byteLength(header); cursor < record.length - words.length; cursor += words.length) words.copy(record, cursor);
  record[record.length - 1] = 10;
  const fixture = Buffer.concat(Array.from({ length: recordCount }, () => record));
  const fixturePath = testInfo.outputPath('20-gib-target-fixture.mbox');
  await writeFile(fixturePath, fixture);

  await page.goto('/');
  const started = performance.now();
  await page.locator('#fileInput').setInputFiles(fixturePath);
  await expect(page.locator('.archive-meta')).toContainText(`${recordCount} messages`);
  const mibPerSecond = recordCount / ((performance.now() - started) / 1000);
  const evidence = {
    fixtureMiB: recordCount,
    measuredMiBPerSecond: Number(mibPerSecond.toFixed(2)),
    briefMinimumMiBPerSecond: 34.13,
    regressionGuardMiBPerSecond: 40,
  };
  await testInfo.attach('cold-file-throughput.json', { body: JSON.stringify(evidence, null, 2), contentType: 'application/json' });
  console.log(`cold-file throughput: ${evidence.measuredMiBPerSecond} MiB/s (guard > ${evidence.regressionGuardMiBPerSecond} MiB/s)`);

  // The brief is 20 GiB in <10 minutes = 34.14 MiB/s. This deterministic
  // 128 MiB browser fixture exercises the worker, IndexedDB queue, and UI.
  // Keep a 17% buffer above the product floor (34.13 MiB/s) so this remains a
  // release gate rather than a timing lottery on a cold browser worker.
  expect(mibPerSecond).toBeGreaterThan(40);
});

test('builds a deterministic new PWA cache when only app assets change', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'One browser proves the release artifact contract.');
  const html = await readFile('dist/index.html', 'utf8');
  const [worker, manifest] = await Promise.all([readFile('dist/sw.js', 'utf8'), readFile('dist/manifest.webmanifest', 'utf8')]);
  const version = appReleaseVersion(html);
  const appOnlyHtml = html.replace(/(\/assets\/index-)[^"']+/, '$1app-only-release.js');

  expect(appOnlyHtml).not.toBe(html);
  expect(appReleaseVersion(appOnlyHtml)).not.toBe(version);
  expect(worker).toContain(`paper-trail-shell-${version}`);
  expect(worker).not.toContain('__APP_RELEASE__');
  expect(manifest).toContain(`/?v=${version}`);

  await page.goto('/');
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  const servedWorker = await page.evaluate(() => fetch('/sw.js', { cache: 'no-store' }).then((response) => response.text()));
  expect(servedWorker).toContain(`paper-trail-shell-${version}`);
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

test('rejects malformed extension-valid MBOX input with recovery guidance', async ({ page }) => {
  await page.goto('/');
  await page.locator('#fileInput').setInputFiles({
    name: 'not-really.mbox', mimeType: 'application/mbox', buffer: Buffer.from('this is not an mbox format at all'),
  });
  await expect(page.getByRole('alert')).toContainText("This is not an MBOX archive: it must start with a 'From ' envelope line.");
  await expect(page.getByRole('alert')).toContainText('unzip the download and choose the .mbox file');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Find the one email');
  await expect(page.locator('.archive-meta')).toHaveCount(0);
});
