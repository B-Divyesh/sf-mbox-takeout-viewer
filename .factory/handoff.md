# Handoff — repair 2: PASS

Repaired and deployed the QA failures from `64f6b133b4c154d6be8bee03b12ea96009f445a3`. The functional deployment is commit `db8428c` at <https://mbox-takeout-viewer.sociobot.in/>.

## What changed

- Reworked the cold MBOX scanner path so it uses native `Uint8Array#indexOf` to locate MBOX envelope newlines and only runs JavaScript tokenization across the existing bounded 192 KiB searchable window per message. A five-byte carry buffer preserves envelopes split across File slices; offsets, bounded memory, local-only parsing, Bloom search, gzip behavior, and existing UI flows are retained.
- Replaced the scanner's allocation-heavy repeated-token `Map` with a bounded typed-array hash table. Repeated newsletter/thread terms no longer repeatedly update the Bloom filter.
- Kept the existing deterministic 128 MiB browser test and its stricter `>35 MiB/s` guard (the brief equivalence is >=34.13 MiB/s). It now attaches a JSON measurement artifact and prints its measured rate.
- Added `public/staticwebapp.config.json`, which Vite copies to the deployed output. Standard Static Web Apps now serves content-hashed `/assets/*.js` and `/assets/*.css` with `Cache-Control: public, max-age=31536000, immutable`, while `sw.js` and `index.html` revalidate.
- Added a site CSP, `Permissions-Policy`, `X-Frame-Options: DENY`, `X-Content-Type-Options`, and referrer policy in both the Standard SWA config and `_headers` fallback. The CSP permits only same-origin app resources, data/blob images and workers, and the existing optional Sociobot license-verification endpoint.
- Extended the header regression script to verify the emitted Standard SWA configuration, not only `_headers`.

## Verification

From a clean installed checkout:

```bash
npm ci
npm run build
npm run test:headers
npm test
npm run test:e2e
```

All passed: 8/8 Vitest tests; production build; header configuration check; and Playwright 6 passed / 2 intentional mobile skips. The full E2E suite covers the local index/search/read/export workflow, offline controlled reload, gzip streaming/seek, axe serious/critical checks, mobile layout, and console errors.

Focused cold-file regression evidence (desktop Chromium, deterministic 128 MiB fixture; guard remains `>35 MiB/s`):

| Run | MiB/s |
| --- | ---: |
| Full E2E suite | 47.19 |
| Repeat 1 | 48.55 |
| Repeat 2 | 45.86 |
| Repeat 3 | 46.40 |

All runs clear both the 35 MiB/s guard and the 34.13 MiB/s brief-equivalent threshold. The source-test benchmark also passed at 64 MiB.

Live deployment checks after deployment:

- Root is HTTPS 200, has no browser console errors, title/lang/one h1/main/alt checks pass, and desktop load was 789 ms. Evidence: `/work/.evidence/mbox-takeout-viewer-repair-2/verify.json`.
- Live hashed JS and CSS return `Cache-Control: public, max-age=31536000, immutable`; `sw.js` returns `no-cache`.
- Live root and assets return CSP with `frame-ancestors 'none'`, `Permissions-Policy`, and `X-Frame-Options: DENY`.
- Lighthouse live audit: Performance 100, Accessibility 100, Best Practices 100, SEO 100; LCP 1.7 s, TBT 0 ms, CLS 0. Evidence: `/work/.evidence/mbox-takeout-viewer-repair-2/lighthouse.json`.

## Deploy

```bash
npm run build
/opt/fleet/lib/deploy-static.sh mbox-takeout-viewer dist
```

The deployment completed successfully to Azure Standard Static Web Apps; the custom domain returned HTTPS 200 and was then header-verified.

## Known gaps / next steps

No known acceptance gaps. The live app remains entirely local for archive parsing and index storage; the only optional external request is the pre-existing Sociobot license verification call.
