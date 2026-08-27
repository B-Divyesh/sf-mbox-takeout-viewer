# Independent verification 2 — FAIL

**Candidate:** `1d32e356ee15b0011a2a8512c3bed942892e5a03`  
**Live URL:** <https://mbox-takeout-viewer.sociobot.in/>  
**Verified:** 2026-08-27 UTC  
**Scope:** Clean-checkout, production-build, local and deployed PWA QA against the researched brief and factory contract. No product code was changed.

## Verdict

**FAIL.** The deployment is now the exact candidate and the normal viewer, privacy, security, accessibility, responsive, PWA, and performance-audit checks pass. It is not release-ready because the repository's required browser E2E suite reproducibly fails its cold-file 20 GiB throughput guard, and the live host does not apply immutable caching to content-hashed assets.

## Reproducible build and test evidence

Executed at the candidate from a clean tracked worktree:

```text
npm ci                 PASS — 173 packages added; audit: 0 vulnerabilities
npm test               PASS — 8/8 Vitest tests
npm run build          PASS — tsc --noEmit + Vite; dist/ created
npm run test:headers   PASS — built immutable-cache rule assertions pass
npm run test:e2e       FAIL — desktop 128 MiB / 20 GiB-target test fails
```

There is no `lint` script; `npm run build` contains the available TypeScript type check. Playwright Chromium was installed from the repository-pinned Playwright version before browser tests.

The browser failure was reproduced twice with:

```text
npx playwright test --grep 'sustains the 20 GiB' --reporter=line
```

The desktop test fails at `tests/app.spec.ts:59`: the expected `128 messages` workspace is not reached within the locator's 5,000 ms timeout (mobile is intentionally skipped). The captured progress at the first full-suite run was 115/128 messages, 90.6%, 116.0 MB, 25.2 MB/s. This is below the brief's required 34.13 MiB/s for 20 GiB in ten minutes. A separate subsequent hot-file ad-hoc run completed in 2.684 s / 47.70 MiB/s; it does not remove the reproducible cold-file quality-gate failure or demonstrate the stated 20 GiB laptop target.

The non-throughput browser coverage passes:

```text
npx playwright test --grep 'indexes, searches|reloads its shell|streams and seeks' --reporter=line
5 passed, 1 intentionally skipped
```

Production build sizes: main JS 37,286 B raw / 13,770 B gzip; worker 5,669 B raw; CSS 14,005 B raw / 4,000 B gzip; hero WebP 128,146 B. The initial JS and CSS budgets are met.

## Product and boundary exercise

On local production preview and, where noted, the live deployment:

- Normal case: indexed the two-message sample, searched `tiny local`, opened the result, selected it, and exported the original-message ZIP. Desktop keyboard activation and Back restored focus to the originating result.
- Gzip case: indexed and opened the second message from a streamed `.mbox.gz` fixture; the gzip seek/decompression path passed on desktop.
- Invalid-input recovery: rejected `bad.txt` with the announced `.mbox`, `.mbx`, or `.mbox.gz` instruction, then immediately indexed a valid MBOX.
- Adversarial HTML email: a message containing a script, event handler, remote tracking image, iframe, and `javascript:` link rendered only safe body text. The sandboxed iframe contained zero script/iframe elements, no event handlers, and no `src`; zero requests reached the hostile domain.
- Desktop and 390 × 844 mobile: no horizontal overflow (`scrollWidth = 390` at 390 CSS px); the mobile message sheet was 358 px wide within 16 px margins.
- Keyboard/focus: skip link, Enter activation, visible 4 px focus outline, and reader focus return passed. With `prefers-reduced-motion: reduce`, computed transition duration was `0.01ms`.
- Accessibility: axe reported zero serious/critical violations on local hostile-reader and live reader paths. HTML has `lang=en`, a title, one initial h1, skip link, main landmark, labels, meaningful hero alt text, and legal links.
- PWA: after service-worker control, offline reload rendered “Find the one email…” and the offline banner. Cache name was `paper-trail-shell-v3`. A controlled QA-only v3-to-v4 service-worker response triggered the in-app “A new version is ready” toast; no repository file was modified.

## Privacy, network, deployment, and policy evidence

- Browser request capture on the live normal path recorded five same-origin requests and **zero** third-party requests; no console or page errors occurred. Source inspection finds the only outbound `fetch` is optional Sociobot license verification when a license token exists. No analytics, tracking pixels, or CDN fonts are present.
- The live page references `index-DoG4ZoFQ.js` and `index-Csjz8eFL.css`, exactly the candidate's generated names. SHA-256 matches local `dist/` for both: JS `938fa6e0d5d6f0947b0971ec6791f6d79d2436e8e2e10c06c06cd7867b405ba7`; CSS `af7578b16aff7f92262bc7b4eeb3f474e20462eb376d700040ec88585b45c8fd`. Live `sw.js` is `paper-trail-shell-v3`, also matching the candidate.
- Live responses send HSTS, `Referrer-Policy: strict-origin-when-cross-origin`, and `X-Content-Type-Options: nosniff`. They do not send CSP, Permissions-Policy, or frame-embedding protection.
- Lighthouse on the live URL with mobile defaults: Performance **100**, Accessibility **100**, Best Practices **100**, SEO **100**; LCP **1.7 s**, TBT **0 ms**, CLS **0**.

## Defects

### P1 — cold-file throughput E2E quality gate fails

The required `npm run test:e2e` fails consistently in its browser performance test before the 128 MiB archive finishes within 5 seconds. The observed cold fixture progress rate (25.2 MB/s) is below the brief's 20 GiB-in-under-10-minutes minimum. This blocks acceptance until the scanner/persistence path is made reliably faster on a cold local file, or a justified representative benchmark and stable guard demonstrate the actual brief target.

### P2 — deployed hashed assets are not immutable cached

Although `public/_headers` and `npm run test:headers` specify immutable caching, live `/assets/index-DoG4ZoFQ.js` and `/assets/index-Csjz8eFL.css` return `Cache-Control: public, must-revalidate, max-age=30`, the same as HTML and `sw.js`. This violates the static/PWA caching policy and forces repeated revalidation of content-addressed assets. Configure the deployment host's equivalent header rules and recheck the live response.

### P3 — missing deployment defense-in-depth response policies

The live host sends no site-level Content-Security-Policy, Permissions-Policy, or `frame-ancestors`/`X-Frame-Options`. The tested email renderer has its own sandbox and restrictive iframe CSP, so no exploit was found; these remain response-policy hardening gaps.

## Required re-verification

1. Make the cold 128 MiB browser fixture reliably pass the existing 5-second / >35 MiB/s guard and substantiate the 20 GiB-under-10-minute requirement without exceeding the memory constraint.
2. Apply immutable cache headers at the deployed host for hashed JS/CSS while keeping HTML and `sw.js` revalidatable.
3. Add the missing host response policies where compatible, then rerun clean install, full E2E, mobile, hostile-email, service-worker update/offline, axe, Lighthouse, hash identity, and header checks.
