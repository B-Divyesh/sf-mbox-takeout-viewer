# Independent verification — FAIL

**Verifier:** factory verifier  
**Candidate commit:** `e45847886e8ca0dc02bd52cdcd305cc2974c2dcf`  
**Live URL:** <https://mbox-takeout-viewer.sociobot.in/>  
**Verified:** 2026-08-27 UTC  
**Scope:** static PWA viewer/search/extractor against the researched brief and factory product contract. No product code was modified.

## Verdict

**FAIL.** The normal product flow, privacy controls, PWA offline reload, MIME safety checks, accessibility automation, responsive layout, and live/candidate identity all passed. The candidate does not meet the researched product's stated 20 GiB / under-10-minute indexing success measure, and it breaks promised keyboard focus restoration after closing a reader.

## Commands and build evidence

Executed from a clean checkout at the candidate commit:

```text
npm ci                         PASS — 174 packages audited, 0 vulnerabilities
npm test                       PASS — 5/5 Vitest tests
npm run build                  PASS — tsc --noEmit + Vite; dist/ produced
npm run test:e2e               PASS after installing the repository-pinned Playwright Chromium:
                                 5 passed, 1 intentionally skipped mobile duplicate gzip case
```

There is no separate lint script in `package.json`; the production build runs the available TypeScript check. Production output is 37,191 B main JS (13,740 B gzip), 3,756 B worker JS, 14,005 B CSS (4,000 B gzip), and a 128,146 B hero WebP. Initial JavaScript is well below the 200 KB budget.

Local production-preview Lighthouse (headless Chromium): Performance **99**, Accessibility **100**, Best Practices **100**, SEO **100**; FCP 905 ms, LCP 1,957 ms, TBT 0 ms, CLS 0.

## End-to-end and input evidence

Passed on production preview at desktop and 390 × 844:

- Opened the built-in normal MBOX sample; indexed 2 messages, searched it, opened a message, selected it, and downloaded the EML ZIP.
- Indexed and read a gzip MBOX, including a message requiring streamed re-decompression/seek (desktop; repository test deliberately skips the duplicate mobile gzip execution).
- Tested a 128 MiB generated MBOX with 128 records in-browser through the drag/drop File API. It indexed in 6,551 ms, or **19.54 MiB/s**. Straight-line projection to 20 GiB is **17.5 minutes**, not the brief's under-10-minute success measure. This was measured inside Chromium without CDP file-transfer overhead.
- Searched a word placed beyond the 64 KiB prefix; the Bloom-index route returned the record.
- Read a malicious HTML message containing a remote pixel, `<script>`, an event handler, and a `javascript:` link. The reader had an empty `sandbox`, the remote URL was never requested, script/event content did not execute, and unsafe URL attributes were removed.
- Submitted a malformed but extension-valid MBOX without an `From ` envelope delimiter. It recovered as one indexed record with no console/page errors.
- Reloaded after indexing: the saved archive appeared as a reconnectable recent archive. Offline reload after service-worker control rendered the shell successfully.

## Defects

### P1 — multi-GB performance promise is not met

The researched brief's success measure is indexing a 20 GB MBOX in under 10 minutes. The 128 MiB in-browser test achieved 19.54 MiB/s, projecting to 17.5 minutes for 20 GiB, 75% above the target. The worker performs JavaScript work per byte (`recent` string/window management, tokenization, Bloom creation, and prefix collection), so this result is consistent with the implementation rather than a one-off UI delay. No 20 GiB fixture was available, but this measured extrapolation is sufficient to fail the stated target.

### P2 — keyboard focus is lost after returning from the reader

The interaction thesis says Back returns focus to the originating message row. In `openMessage`, `focusReturn` saves the old button; `render()` removes that element. On Back, calling `.focus()` on the detached element leaves focus on the document body rather than the corresponding row. Reproduced with keyboard/browser automation after opening the sample message. This impairs keyboard-only continuity despite otherwise visible 4 px focus styling.

### P2 — deployed hashed assets lack immutable browser caching

The live JS and CSS assets return `Cache-Control: public, must-revalidate, max-age=30` rather than a long-lived immutable policy. The service worker provides an app-shell cache, but normal browser caching does not satisfy the stated hashed-asset caching policy and causes needless revalidation. This is a deployment/configuration defect; it was not changed here.

## Accessibility, privacy, security, and deployment checks

- `title`, `lang="en"`, one initial `<h1>`, skip link, `<main>`, labels, landmarks, alt text, responsive 390 px layout, visible 4 px `:focus-visible`, and reduced-motion CSS were inspected.
- Axe on the initial and reader paths reported **zero serious/critical findings** locally and on live desktop/mobile. No console or page errors were observed in those flows.
- Keyboard-only smoke test activated the sample flow and confirmed the skip-link focus ring; the reader-return focus failure above is the exception.
- Normal live page requests stayed on `mbox-takeout-viewer.sociobot.in`; no analytics, tracking, CDN font, or email-content request was observed. Code inspection found only optional Sociobot license verification/checkout outbound calls. Privacy and terms pages exist and accurately describe local storage and this optional API.
- HTML email is parsed, stripped, placed in a sandboxed iframe, and supplied a restrictive frame CSP. The tested adversarial payload caused no outbound request or execution.
- Live HTTPS sends HSTS, `X-Content-Type-Options: nosniff`, Referrer-Policy, and DNS-prefetch control. It does **not** send a site-level CSP, `frame-ancestors`/`X-Frame-Options`, or Permissions-Policy; these are defense-in-depth gaps, not independently exploited in this audit.
- PWA manifest contains 192/512/maskable icons, standalone display, and versioned start URL. The service worker has `skipWaiting`, `clients.claim`, shell precache, update detection/toast code, and passed controlled offline reload. Its cache key is hard-coded (`paper-trail-shell-v2`), so future release cache-key discipline should be verified at every deployment.
- Live identity: fetched live `index.html`, `index-BcZBB-ro.js`, `index-Csjz8eFL.css`, and `sw.js`. HTML references the candidate build's two hashed assets; SHA-256 of live JS/CSS/service worker exactly matched `dist/`/`public/` from this commit.

## Required remediation and re-verification

1. Profile and optimize the byte scanner/index representation until a representative 20 GiB laptop run demonstrates under 10 minutes and memory remains under 1 GiB; add a scalable benchmark or performance guard.
2. Preserve an identifier for the invoking result and focus the newly rendered matching button/row after Back.
3. Configure immutable caching for content-hashed assets and recheck live headers after deployment.
4. Re-run the complete clean-install, build, desktop/mobile, adversarial MIME, offline, axe, Lighthouse, and live identity suite after remediation.
