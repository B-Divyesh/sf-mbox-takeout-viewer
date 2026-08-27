# Independent verification 3 — FAIL

**Candidate:** `57756679295b21f8b228e29e8b4b284731137365` (`main`)

**Live URL:** <https://mbox-takeout-viewer.sociobot.in/>

**Date:** 2026-08-27 UTC

## Verdict

**FAIL.** This is a real, deployed build (the live `index.html`, hashed JS/CSS asset names, and `sw.js` SHA-256 exactly match a fresh production build of the candidate), but it does not meet the multi-GB performance commitment or all PWA/input-recovery acceptance requirements.

## Release-blocking defects

### P1 — 20 GiB indexing target is not reliably met; the declared browser suite fails

The brief requires indexing 20 GiB in under ten minutes, equivalent to at least **34.13 MiB/s**. The repository's own deterministic, cold-file, desktop-browser 128 MiB regression is stricter: `>35 MiB/s`.

After a clean `npm ci`, installing the pinned Playwright Chromium required by the repository, the complete browser run produced **5 passed, 1 failed, 2 expected mobile skips**. The failed test was `sustains the 20 GiB indexing target on a deterministic 128 MiB MBOX`, at **30.97 MiB/s**.

Three independent reruns of that one test measured **32.00**, **31.35**, and **35.54 MiB/s**. Thus 3/4 fresh measurements miss even the brief's lower 34.13 MiB/s floor, and the exact production E2E quality gate is red. The product cannot claim the 20 GiB/<10 min job-to-be-done on this verifier hardware.

### P1 — PWA can indefinitely serve a prior app release when only app assets change

`public/sw.js` uses a fixed cache name, `paper-trail-shell-v3`, and returns the app shell cache-first (`caches.match(url.pathname)`) before network. The production build does not generate a per-build cache version or otherwise change `sw.js` when only Vite-hashed application assets change.

Browser reproduction against the live candidate:

1. Loaded the app and waited for the real service worker to control the page.
2. Made a synthetic newer `/?qa-release=2` HTML response available at the network boundary, with heading `NEW RELEASE MARKER`, while keeping the service-worker response unchanged (the condition for a normal app-only deploy).
3. Navigated to that URL. The controlled page made **0** network requests, retained title `Paper Trail — private Gmail Takeout viewer`, and rendered the old `Find the one email in 20 GB.` heading instead of the newer response.

This is good offline behaviour only until a release happens; then it prevents an unchanged service worker from seeing a changed app shell. The app does show its “A new version is ready” toast when the worker itself changes (separately verified with an old-worker-to-live-worker update), but that does not repair app-only releases. It fails the required versioned-cache/update path.

## Other defects

### P2 — Invalid `.mbox` content is accepted and falsely reported as indexed mail

Uploaded a 33-byte file named `not-really.mbox` containing only `this is not an mbox format at all`. The application entered the workspace, showed `1 messages · 33 B`, and announced `Indexed 1 messages.` There was no validation error or recovery guidance. A file-extension check is present, but no MBOX-envelope validation occurs before success is reported. This violates the invalid-input/recovery expectation and can mislead a records user into believing an unreadable export was imported.

## Successful checks

### Clean checkout and repository gates

From clean candidate checkout:

```bash
git clean -xfd
npm ci
npm run build
npm run test:headers
npm test
npm run test:e2e
```

- `npm ci`: passed; 0 dependency vulnerabilities reported.
- `npm run build`: passed (`tsc --noEmit` plus Vite) and emitted `dist/`.
- `npm run test:headers`: passed.
- `npm test`: passed, 8/8 Vitest tests.
- No lint script exists in `package.json`; the build's TypeScript no-emit check is the available type gate.
- `npm run test:e2e`: **failed as described above**. Other exercised E2E cases passed: local index/search/read/EML ZIP, gzip stream/seek, and offline controlled reload; mobile stress/gzip cases are intentionally skipped by the suite.

The build budget is healthy: main JS is 37,286 bytes (13,770 gzip), worker JS 6,189 bytes, CSS 14,005 bytes (4,000 gzip), and the only hero image is 128,146 bytes. Initial JavaScript is well below 200 KB gzip and CSS is below 50 KB.

### End-to-end product behaviour

On the live candidate, tested desktop Chromium and 390×844 mobile:

- Opened the built-in sample, searched, opened plain-text and HTML mail, selected/exported EML ZIP, downloaded `note.txt`, exported CSV and reusable JSON index, forced an empty search state, and recovered with Clear filters.
- Rejected a `.txt` upload with `Choose a .mbox, .mbx, or .mbox.gz archive.` and then successfully recovered by opening the sample.
- Gzip stream/seek and controlled offline reload passed in the repository browser suite.
- Keyboard: Tab reaches the skip link first with a 4px visible focus ring; on 390px, Tab/Enter activated “Try a tiny sample.” The mobile workspace had `scrollWidth === innerWidth === 390`; reduced-motion emulation set progress transition to `0.01ms`.
- Axe on the live welcome screen found **0 serious/critical** issues; the repository Axe E2E check on the reader also passed. No console errors or `pageerror` events were observed during the exercised desktop/mobile flows.
- Malicious HTML-mail smoke test removed script and nested iframe nodes, stripped a `javascript:` link, blocked the remote tracker request (zero `example.test` requests), and kept only safe visible text.

### Privacy, deployment, policy, and PWA checks

- During live normal/sample use, every browser request was same-origin; no analytics, upload, or remote email-content request was observed. Source review confirms the optional Sociobot license verification is the only allowed external `connect-src`.
- Live `index.html` SHA-256 equals local `dist/index.html`: `f6c5702952609217a7be3dbc00ec9f321e2cdb5c87df8daf4e59d2283948346a`. Live asset names exactly match `index-tbXGrI4h.js` and `index-Csjz8eFL.css`; live `sw.js` SHA-256 equals local `public/sw.js`: `2187c0e7c7b9b27ab7c118a395f77dc8165feb8c3b815634ef08804ec2b3c845`.
- HTTPS root was 200 with HSTS, CSP, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, referrer and permissions policies. Root and `sw.js` are `no-cache`; hashed JS/CSS are `public, max-age=31536000, immutable`.
- Service worker is registered and controls the live page; controlled offline reload passes. The worker-change update toast was exercised successfully. The cache-version defect above remains release-blocking.
- Live Lighthouse: Performance **99**, Accessibility **100**, Best Practices **100**, SEO **100**; LCP 1,755 ms, TBT 125 ms, CLS 0.

## Required remediation and re-verification

1. Make cold MBOX indexing consistently exceed the brief floor with margin on the deterministic desktop browser test; rerun the complete browser suite until it passes.
2. Generate/derive a cache version from every production app build (or use a network-first versioned app shell) so a new release cannot be hidden by a byte-identical worker. Retest both an app-only deployment and an actual worker update.
3. Validate MBOX structure before indexing and present a clear invalid-file error with a retry path.
4. Re-run all commands and live checks above after deployment, then replace this report only with a PASS supported by fresh measurements.
