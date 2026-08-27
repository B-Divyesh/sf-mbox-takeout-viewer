import { readFile } from 'node:fs/promises';

const [headers, html] = await Promise.all([
  readFile(new URL('../dist/_headers', import.meta.url), 'utf8'),
  readFile(new URL('../dist/index.html', import.meta.url), 'utf8'),
]);

for (const extension of ['js', 'css']) {
  if (!headers.includes(`/assets/*.${extension}\n  Cache-Control: public, max-age=31536000, immutable`)) {
    throw new Error(`Missing immutable cache rule for hashed .${extension} assets.`);
  }
  if (!new RegExp(`/assets/[^\"']+-[A-Za-z0-9_-]+\\.${extension}`).test(html)) {
    throw new Error(`Build does not reference a content-hashed .${extension} asset.`);
  }
}
if (!headers.includes('/sw.js\n  Cache-Control: no-cache')) throw new Error('Service worker must revalidate.');
console.log('Hashed JS/CSS assets have one-year immutable cache directives.');
