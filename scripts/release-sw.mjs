import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

/**
 * The worker must change when the app shell changes.  This is deliberately a
 * content hash, not a build timestamp: identical releases produce identical
 * files while every new Vite asset graph produces a new shell cache.
 */
export function appReleaseVersion(html) {
  return createHash('sha256').update(html).digest('hex').slice(0, 16);
}

export function renderServiceWorker(template, version) {
  if (!/__APP_RELEASE__/.test(template)) throw new Error('Service worker template has no release marker.');
  return template.replaceAll('__APP_RELEASE__', version);
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const dist = new URL('../dist/', import.meta.url);
  const [html, template, manifest] = await Promise.all([
    readFile(new URL('index.html', dist), 'utf8'),
    readFile(new URL('sw.js', dist), 'utf8'),
    readFile(new URL('manifest.webmanifest', dist), 'utf8'),
  ]);
  const version = appReleaseVersion(html);
  if (!/__APP_RELEASE__/.test(manifest)) throw new Error('Manifest has no release marker.');
  await Promise.all([
    writeFile(new URL('sw.js', dist), renderServiceWorker(template, version)),
    writeFile(new URL('manifest.webmanifest', dist), manifest.replaceAll('__APP_RELEASE__', version)),
  ]);
  console.log(`Generated release-specific service worker cache: ${version}`);
}
