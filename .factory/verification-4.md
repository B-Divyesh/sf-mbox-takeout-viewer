# Independent verification 4 — FAIL

**Candidate:** `110dbf14cee44cbe5b1479df749716720e8f0257` (`main`)

**Live URL:** <https://mbox-takeout-viewer.sociobot.in/>

**Date:** 2026-08-27 UTC

## Verdict

**FAIL.** The live site is exactly the candidate production build and the repaired functional, privacy, PWA, accessibility, and policy paths work. However, fresh independent runs consistently miss the brief's central 20 GiB indexing target and fail the repository's production browser suite. This is a release-blocking P1 for a product whose reason to exist is making multi-GB Takeout files usable.

## Release-blocking defect

### P1 — browser indexing throughput remains below the 20 GiB / 10 minute requirement

The brief requires 20 GiB in less than 10 minutes, which requires at least **34.13 MiB/s**. The candidate's browser regression deliberately uses a stricter **>40 MiB/s** guard on a deterministic, cold 128 MiB MBOX.

After a clean `npm ci`, production build, and installation of the Chromium revision required by the candidate's resolved Playwright 1.62.1, the complete suite failed only that test. The first measurement was **30.88 MiB/s**. Three further isolated desktop reruns measured **33.37**, **30.97**, and **31.05 MiB/s**. Every run misses the 40 MiB/s repository gate; all but none meet the brief's 34.13 MiB/s minimum (the highest is still 0.76 MiB/s below it).

This is not a deployment-only issue: it is reproducible against the fresh local production `dist/` on the verifier hardware. The full suite result is **8 passed, 3 skipped, 1 failed**. With the throughput test excluded, all remaining browser cases are **8 passed, 2 intentionally skipped**.

## Passing evidence

### Clean checkout, build, and repository checks

Commands executed from this candidate checkout:

```bash
npm ci
npm run build
npm run test:headers
npm test
npx playwright install chromium
npm run test:e2e
npx playwright test --grep-invert 'sustains the 20 GiB'
```

- `npm ci` passed with 0 reported vulnerabilities.
- `npm run build` passed (`tsc --noEmit`, Vite, and release-specific worker generation) and generated `dist/`.
- `npm run test:headers` passed.
- `npm test` passed: 10/10 Vitest tests.
- There is no lint script; TypeScript checking is part of the exact build.
- Playwright initially could not launch from only `npm ci`, because package.json's `^1.62.1` resolved to Playwright 1.62.1 while the supplied preinstalled browser was another revision. Installing the matching Chromium as permitted by the work order resolved the environment setup. Product results above use that matching browser.

Production artifact size is within the static/PWA budgets: main JS 37,294 B / **13,784 B gzip**, worker 6,800 B, CSS 14,005 B / **4,009 B gzip**, and hero WebP 128,146 B. Initial JS and CSS are both well under the 200 KB and 50 KB gzip budgets.

### Live deployment identity, security, and caching

- The live root SHA-256 and candidate `dist/index.html` SHA-256 are both `a7eba2e661450dc2c780b44a044ea41af685ce8c87ebc9679f68a8d1fd43d403`.
- Live JS and CSS SHA-256 exactly match the candidate's emitted assets; live `sw.js` SHA-256 exactly matches candidate `dist/sw.js` (`86d24d1af4c2de8488e0777981a963662892a675975597c1dc6bf5ddc1f93502`). The manifest release identity is `a7eba2e661450dc2`.
- HTTPS serves HSTS, CSP, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, Referrer-Policy, and Permissions-Policy. CSP restricts scripts, styles, media, workers, and frames to self; the sole allowed external connection is the optional Sociobot license verifier.
- Root and worker are `no-cache`; hashed JS/CSS are `public, max-age=31536000, immutable`.

### Product, input, privacy, PWA, and accessibility smoke tests

Live desktop and 390×844 mobile Chromium checks found:

- Local sample index/search/read, no-result state plus Clear filters recovery, EML ZIP export, gzip streaming/seek, malformed extension-valid MBOX rejection/recovery, and original bad-extension rejection all passed.
- A hostile HTML MBOX containing a script, nested iframe, remote tracker image, and `javascript:` link rendered safe text only. The sandboxed message had 0 script/iframe/javascript-link nodes and made 0 requests to `example.test`.
- Normal/sample use requested only `https://mbox-takeout-viewer.sociobot.in`; no mail, filename, search, analytics, or tracker requests left the origin. Source review confirms license verification is opt-in and the only external runtime endpoint.
- The live page has title, `lang="en"`, one h1, main landmark, skip link, and 0 axe serious/critical findings. No console errors or page errors occurred in exercised flows.
- At 390 px there was no horizontal overflow (`scrollWidth = innerWidth = 390`). Keyboard focus on the sample button was visible (`solid 4px`); Enter opened the local sample. Under reduced-motion emulation, the indexing progress transition was `0.00001s`.
- The live service worker controlled the page and controlled offline reload returned the app shell. A fresh-context old-worker-to-current-worker simulation intercepted the old `sw.js`, then updated to the live candidate; it produced the visible `A new version is ready. Reload when convenient.` toast. The repository's app-only release artifact contract also passed.
- Live Lighthouse (headless mobile-style run): Performance **96**, Accessibility **100**, Best Practices **100**, SEO **100**; LCP **1.7 s**, TBT **230 ms**, CLS **0**.

## Required remediation

Make cold browser indexing reliably exceed the 34.13 MiB/s product floor with material margin on the deterministic fixture, then rerun the exact complete browser suite until it passes. Do not claim the multi-GB job-to-be-done until that result is stable. All other tested candidate repairs can be retained.
