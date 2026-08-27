import { readFile } from 'node:fs/promises';

const [headers, html, staticWebApp] = await Promise.all([
  readFile(new URL('../dist/_headers', import.meta.url), 'utf8'),
  readFile(new URL('../dist/index.html', import.meta.url), 'utf8'),
  readFile(new URL('../dist/staticwebapp.config.json', import.meta.url), 'utf8'),
]);
const config = JSON.parse(staticWebApp);

for (const extension of ['js', 'css']) {
  if (!headers.includes(`/assets/*.${extension}\n  Cache-Control: public, max-age=31536000, immutable`)) {
    throw new Error(`Missing immutable cache rule for hashed .${extension} assets.`);
  }
  if (!new RegExp(`/assets/[^\"']+-[A-Za-z0-9_-]+\\.${extension}`).test(html)) {
    throw new Error(`Build does not reference a content-hashed .${extension} asset.`);
  }
}
if (!headers.includes('/sw.js\n  Cache-Control: no-cache')) throw new Error('Service worker must revalidate.');

for (const extension of ['js', 'css']) {
  const assetRoute = config.routes?.find((route) => route.route === `/assets/*.${extension}`);
  if (assetRoute?.headers?.['Cache-Control'] !== 'public, max-age=31536000, immutable') {
    throw new Error(`Standard Static Web Apps must give hashed /assets .${extension} files one-year immutable caching.`);
  }
}
for (const [header, expected] of [
  ['Content-Security-Policy', "default-src 'self'"],
  ['Permissions-Policy', 'camera=()'],
  ['X-Frame-Options', 'DENY'],
] ) {
  const value = config.globalHeaders?.[header];
  if (typeof value !== 'string' || !value.includes(expected)) throw new Error(`Missing Standard Static Web Apps ${header} policy.`);
}
if (!config.globalHeaders['Content-Security-Policy'].includes("frame-ancestors 'none'")) {
  throw new Error('CSP must deny framing.');
}
console.log('Hashed assets, CSP, frame protection, and Permissions Policy are configured for Standard Static Web Apps.');
