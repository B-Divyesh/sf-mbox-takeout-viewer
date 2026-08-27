# Independent verification 5 — FAIL

**Candidate:** `baed10d4295eb0536014ad2c86e014210a8b5725` (`main`)

**Live URL:** <https://mbox-takeout-viewer.sociobot.in/>

**Verified:** 2026-08-27 UTC

## Verdict

**FAIL.** The live application is byte-for-byte the candidate production build, and its build, automated suite, PWA, normal reader/export, privacy, security, responsive, and accessibility checks pass. It is not acceptable for the stated job because its core search can report a message as matching a term that does not occur anywhere in that message. This is a reproducible, high-rate false-positive failure in the full-text search route.

## Release-blocking defect

### P1 — full-text search returns fabricated matches for absent words

The product is a viewer/searcher for large archives and the UI says that search “matches headers and the first 192 KB of each message.” The candidate instead treats a hit in a 1 KiB Bloom filter as a match without reading or verifying the message.

Fresh live-browser reproduction against the candidate deployment:

1. Uploaded a valid one-message `bloom.mbox` whose body contains 5,000 distinct, known words (`uniquetoken00000` through `uniquetoken04999`), and no `definitelyabsent…` string. The whole fixture is within the advertised first-192-KiB search scope.
2. Searched twenty guaranteed-absent one-word queries, `definitelyabsent0000` through `definitelyabsent0019`.
3. **14/20** queries returned **“1 of 1 messages”** rather than the required empty result. Examples: `definitelyabsent0000`, `0002`, `0003`, `0004`, `0006`–`0009`, `0011`, `0013`, and `0015`–`0018`.

The source confirms the cause: `filteredRecords()` accepts `bloomHas(record.bloom, term)` as conclusive, while `BLOOM_BYTES` is only 1,024 and the scanner adds up to/over 4,096 distinct terms. A Bloom filter may rule a record out but cannot establish that it contains a word. High-vocabulary messages (including ordinary long HTML mail) therefore produce misleading results at a material rate. This directly breaks the primary “find the one email” job; users cannot rely on a displayed result to contain the requested term.

## Passing evidence

### Clean checkout and repository gates

Ran from the candidate after `git clean -xfd` and `npm ci`:

```text
npm test                 PASS — 12/12 Vitest tests
npm run build            PASS — TypeScript --noEmit, Vite production build, release-specific SW
npm run test:headers     PASS — header/cache policy contract
npx playwright test      PASS — 9 passed, 3 intentional mobile skips
```

The first Playwright invocation correctly reported the resolved Playwright 1.62.1 Chromium binary absent from the supplied browser cache. Per the work order, `npx playwright install chromium` installed that exact revision; the complete fresh browser suite then passed. There is no separate lint script; the exact production build contains the available type check.

The deterministic desktop 128 MiB MBOX regression measured **53.19 MiB/s** against its `>40 MiB/s` guard (brief floor: 34.13 MiB/s for 20 GiB/10 min). The initial production payload is within budget: main JS **13,784 B gzip**, CSS **4,018 B gzip**, worker **6,886 B raw**, hero WebP **128,146 B**.

### Product paths exercised

- Desktop live normal flow: local sample index, query, open/read, keyboard focus returning to the original result, selection, and EML ZIP download (`paper-trail-sample.mbox-selection.zip`).
- Live sample attachment: opened the HTML/attachment message and downloaded `note.txt` (29 B).
- Live invalid input: an extension-valid non-MBOX was rejected with the explicit envelope/recovery guidance; the welcome screen remained usable.
- Repository browser coverage also freshly passed gzip streamed seek/read, malformed-MBOX recovery, deterministic app-only cache identity, offline reload, desktop and 390×844 sample flow, and reader axe smoke.
- Export threshold boundary on live: exactly **1,000** selected messages produced `boundary-1000.mbox-selection.zip` with no paywall; **1,001** selected messages opened the one-time bulk-unlock dialog, without attempting checkout.

### Accessibility, responsive, privacy, PWA, and security

- Live desktop reader axe: **0 serious/critical** violations. The app has `lang=en`, title, exactly one h1, main landmark, and the source/root DOM includes the skip link.
- At 390×844, `scrollWidth === innerWidth === 390`; keyboard Enter activated the sample button, `:focus-visible` was a solid **4 px** outline, and reduced-motion transition duration was **0.00001 s**. No console or page errors arose in the exercised flows.
- A live hostile HTML email containing script, iframe, external image, and `javascript:` link rendered safe body text only: 0 scripts, 0 nested iframes, 0 remote-image sources, 0 JavaScript links, and 0 requests to `example.test`.
- Normal live sample use made no third-party requests; no analytics, tracking, email content, filename, or search query left the origin. The CSP permits only the optional Sociobot license endpoint in `connect-src`; source review confirms it is called only when a locally stored license token exists.
- The real live service worker controlled the page with cache `paper-trail-shell-d1107a5c12e822eb`; offline reload returned the app shell and offline notice. A controlled old-worker-to-live-worker update produced the visible “A new version is ready. Reload when convenient.” notice and the release-specific cache.
- Live Lighthouse (mobile defaults): Performance **98**, Accessibility **100**, Best Practices **100**, SEO **100**; LCP **1,727 ms**, TBT **140 ms**, CLS **0**.

### Deployment identity and response policy

Fresh production build and live response hashes matched exactly:

```text
index.html                  d1107a5c12e822ebd4ae865c381fe455073ec8d765adaec1d94d4b71fa664e95
assets/index-DNLhduZu.js   3dd8f5cd76440e1c883fe2ad7f634c589fbf51f4e04154253cc9edd63ce55bb3
assets/index-Csjz8eFL.css  af7578b16aff7f92262bc7b4eeb3f474e20462eb376d700040ec88585b45c8fd
sw.js                       7c90391f522ec46e40b19464f6f91e1690520966b7684edd9a1048d4b590289c
```

HTTPS root and `sw.js` are `no-cache`; hashed JS/CSS are `public, max-age=31536000, immutable`. The live site sends HSTS, restrictive CSP, Permissions-Policy, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, and `Referrer-Policy: strict-origin-when-cross-origin`. `/privacy` and `/terms` both return 200 and describe the local-first data boundary and optional license path.

## Required remediation

Do not use Bloom membership as final search confirmation. Either keep an exact bounded search representation that has no false positives, or treat Bloom hits as candidates and verify the requested terms against the relevant on-disk message bytes before displaying them as matches (with progress/cancellation appropriate to the archive size). Add browser regression coverage using a high-distinct-token message and absent queries, then rerun the full clean-install, build, PWA, live identity, and accessibility verification.
