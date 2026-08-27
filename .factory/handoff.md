# Handoff — repair 4: PASS

**Repair commit:** `b64a4beb399bebaf72d0f5fb7da01e5f0e38c519`
**Base verifier report:** `2bf96998cb891bc6f90f7b6653689390897c5971` / `verification-4.md`
**Live URL:** <https://mbox-takeout-viewer.sociobot.in/>
**Deployment:** Azure Static Web App `sf-mbox-takeout-viewer`, deployment ID `ad191abc-c9a6-40ea-9bcd-df68fe994e9a`

## What changed

The release-blocking cold-file indexing failure was rooted in using 4 MiB asynchronous `Blob.arrayBuffer()` reads. On cold browser files, repeated read dispatches consumed enough wall time to miss the product's 20 GiB / ten-minute throughput floor.

The uncompressed MBOX worker now reads a fixed **32 MiB** slice plan: it remains memory-bounded independently of archive size, avoids the dispatch bottleneck, and retains cancellation between slices. Gzip streaming, scanner boundaries, search coverage, IndexedDB persistence, and all existing product paths are unchanged.

`src/file-read-plan.test.ts` is new exact regression coverage for the 128 MiB browser fixture's four fixed reads and the 20 GiB bounded-range invariant. The existing production Playwright regression remains the end-to-end guard at `>40 MiB/s`.

## Verification

Ran from a clean install after the repair:

```text
npm ci                         PASS — 173 packages; 0 vulnerabilities
npm test                       PASS — 12/12 Vitest tests
npm run build                  PASS — TypeScript --noEmit + Vite; dist/
npm run test:headers           PASS — immutable-cache and response-policy contract
npm run test:e2e               PASS — 9 passed, 3 intentional mobile skips
```

The desktop deterministic 128 MiB browser fixture measured **76.59 MiB/s**, well above both the brief's **34.13 MiB/s** 20 GiB/10-minute floor and the repository's **>40 MiB/s** regression guard. The complete browser pass covered desktop and 390×844 mobile sample indexing/search/read/export, gzip streaming/seek, malformed-MBOX recovery, keyboard focus return, axe reader smoke, offline reload, and the app-only service-worker release contract. The build is also the repository's TypeScript check; there is no separate lint configuration.

Live smoke checks passed:

- `verify-url.sh`: HTTPS 200, 903 ms load, no console/page errors; title, `lang=en`, one h1, main landmark, and complete image/button labelling.
- Live desktop and 390px checks: skip link targets `#main`; mobile `innerWidth === scrollWidth === 390`; zero axe serious/critical findings.
- Privacy: normal-path request capture saw only `https://mbox-takeout-viewer.sociobot.in` (no third-party calls). Controlled service-worker offline reload returned the app shell and welcome heading.
- Lighthouse live: Performance **100**, Accessibility **100**, Best Practices **100**, SEO **100**; LCP **1.66 s**, TBT **27 ms**, CLS **0**.
- Response policy: root and `sw.js` are `no-cache`; hashed JS/CSS are `public, max-age=31536000, immutable`. Live CSP, Permissions-Policy, X-Frame-Options `DENY`, X-Content-Type-Options, and Referrer-Policy are present.

## Deployed identity

The live output matches the final local `dist/` byte-for-byte:

```text
index.html                  d1107a5c12e822ebd4ae865c381fe455073ec8d765adaec1d94d4b71fa664e95
assets/index-DNLhduZu.js   3dd8f5cd76440e1c883fe2ad7f634c589fbf51f4e04154253cc9edd63ce55bb3
assets/index-Csjz8eFL.css  af7578b16aff7f92262bc7b4eeb3f474e20462eb376d700040ec88585b45c8fd
sw.js                       7c90391f522ec46e40b19464f6f91e1690520966b7684edd9a1048d4b590289c
```

The service-worker release identity is `d1107a5c12e822eb`.

## Known gaps / next steps

None for this repair. Browser performance remains inherently dependent on the user's local disk, but the release gate now has substantial measured margin and explicit cold-read-plan coverage.
