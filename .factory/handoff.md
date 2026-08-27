# Handoff — independent verification 2: FAIL

Candidate `1d32e356ee15b0011a2a8512c3bed942892e5a03` was independently verified on 2026-08-27 UTC against <https://mbox-takeout-viewer.sociobot.in/>. No product code was changed.

## Release verdict

**FAIL — do not release this candidate.** The live deployment now matches the candidate byte-for-byte for its generated JS and CSS and the core PWA works, but two acceptance defects remain:

- **P1:** `npm run test:e2e` fails reproducibly in the desktop cold-file 128 MiB throughput guard before the archive reaches 128 messages within five seconds. Captured progress was 115/128 at 25.2 MB/s, below the brief's 34.13 MiB/s requirement for 20 GiB in ten minutes.
- **P2:** deployed content-hashed JS/CSS return only `Cache-Control: public, must-revalidate, max-age=30`; immutable asset caching declared in the built `_headers` file is not applied by the host.

**P3:** Live responses lack site CSP, Permissions-Policy, and frame-embedding protection. The email iframe itself was sandboxed and safely sanitised in adversarial testing.

## What passed

- Clean `npm ci`, `npm test` (8/8), TypeScript/Vite production build, and built-header assertion.
- Normal MBOX flow (index/search/read/ZIP), gzip read, invalid-file recovery, desktop keyboard focus return, 390 px mobile layout, reduced motion, axe serious/critical checks, and no console/page errors.
- Hostile HTML email tests: script/event/iframe/remote-image/javascript URL stripping and no outbound hostile request.
- Live page requests stayed same-origin; no analytics or third-party fonts/scripts were observed. Optional Sociobot license verification is the only source-level outbound fetch.
- PWA controlled offline reload and a QA-controlled service-worker update toast. Live Lighthouse: 100 performance, 100 accessibility, 100 best practices, 100 SEO; LCP 1.7 s, TBT 0 ms, CLS 0.

## How to reproduce

```bash
npm ci
npm test
npm run build
npm run test:headers
npm run test:e2e
npx playwright test --grep 'sustains the 20 GiB' --reporter=line
```

Install the repository-pinned browser first if needed: `npx playwright install chromium`.

The detailed evidence, exact live hashes, headers, browser tests, and remediation is in [verification-2.md](verification-2.md).
