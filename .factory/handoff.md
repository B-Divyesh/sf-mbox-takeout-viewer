# Repair handoff — perfection loop 1

## Release

- Repair commits: `e2e0cb45d6f988c061e2282025afe18fb162f0e0` (`fix: isolate demo and close review findings`) and `dcd750cc026e1e224142c0f8e15e583db6c82f77` (`fix: add sized social preview metadata`), pushed to `main`.
- Deployed static artifact: Azure Static Web Apps deployment `57e63c04-d07b-4862-9244-7b9909efe0ef`.
- Live URL: <https://mbox-takeout-viewer.sociobot.in/demo>.

## What changed

- Replaced the prior sample action with the direct `/demo` and `?demo=1` sandbox. It selects `demo:paper-trail-index` before any database read, keeps the required banner visible, and deletes only demo storage on Reset demo or Start for real.
- Seeded a three-message sample archive with search, filtering, reading, attachment download, and selected-email export paths.
- Added `/demo/archive/...` and `/archive/...` URLs, history/back handling, route focus announcements, dynamic titles, a product-styled `/404`, and static-host navigation fallback.
- Rewrote first-screen and README copy in plain language; removed unsupported implementation and browser promises while preserving the risograph archive-desk identity.
- Added metadata, canonical/OG/Twitter tags, shared legal-page structure, sitemap routes, catalog description, copy audit, demo guide, and claim registry.
- Added a reviewed 1200×630 social preview, cropped from the product’s original risograph artwork and recorded in the design provenance.
- Added one observable clean-demo browser test per claim in `.factory/claims.json`.

## Verification evidence

From a fresh clone of repair commit `e2e0cb45d6f988c061e2282025afe18fb162f0e0`:

```text
npm ci                         passed (174 packages; 0 vulnerabilities)
npm run build                  passed; dist/index.html produced
npm test                       passed; 13 tests
npm run test:e2e               passed; 21 passed, 1 release-only mobile skip
npm run test:headers           passed
```

Every registry command passed individually on desktop Chromium:

```text
@claim:demo-isolation          passed
@claim:local-network           passed
@claim:no-tracking             passed
@claim:message-reading         passed
@claim:archive-search          passed
@claim:email-export            passed
@claim:attachment-download     passed
@claim:offline-reload          passed
```

Local release checks:

- `verify-url.sh http://127.0.0.1:4173/demo`: HTTP 200; no console errors; title/lang/main/alt/button checks passed.
- Playwright axe integration: no serious or critical findings on the landing screen.
- Lighthouse mobile report: Performance 99, Accessibility 100. The generated report is ignored with other local evidence at `.factory/evidence/local/lighthouse.json`.
- Built entry JavaScript gzip: 14.98 kB; built CSS gzip: 4.11 kB.

Live release check:

```text
verify-url.sh https://mbox-takeout-viewer.sociobot.in/demo
HTTP 200 in 877 ms; no console errors; one h1; lang=en; main present; no missing image alt text.
```

## Known gaps

No known blocking review findings remain. The static host serves unknown SPA paths through the product-styled client 404 so archive deep links continue to reload correctly.
