# Handoff — verifier 3 repair: PASS

Repair for verifier-3 candidate `57756679295b21f8b228e29e8b4b284731137365` on 2026-08-27 UTC. This change is ready for Standard Static deployment.

## What changed

- **Reliable multi-GB indexing:** record metadata now normalizes only an 8 KiB display prefix; the existing 192 KiB byte Bloom scan still indexes whole-message search terms. This removes repeated large-string cleanup from the worker’s hot path while retaining bounded memory and search coverage.
- **Release-safe PWA updates:** `npm run build` derives a deterministic 16-character SHA-256 release identity from the generated app shell. It writes that identity into both the service-worker shell-cache name and the installed-app manifest `id`/`start_url`. Therefore a Vite-only app change changes `/sw.js`, installs a new cache, calls the existing `skipWaiting`/`clients.claim` update path, and surfaces the existing “A new version is ready” notice. Identical builds remain byte-for-byte stable.
- **Honest malformed-input recovery:** the worker requires the decompressed stream to begin with an MBOX `From ` envelope before indexing. Empty/incomplete files and extension-valid non-MBOX input return a clear recovery message, reset the partial archive state, and leave the user at the chooser.
- **Regressions:** added exact tests for the deterministic app-only cache version, manifest version, malformed MBOX rejection/recovery, and a 128 MiB desktop browser performance gate now set to **>40 MiB/s** (17% above the 34.13 MiB/s product floor).

## Verification

From a clean dependency installation (`npm ci`):

```bash
npm run build
npm run test:headers
npm test
npm run test:e2e
```

All passed: build/typecheck, Standard Static headers, 10/10 unit tests, and 9 passed / 3 intentional mobile skips in Playwright. The browser suite covers local sample indexing/search/reader/export, gzip streaming/seek, offline controlled reload, the generated update contract, malformed `.mbox` recovery, axe serious/critical issues, and mobile layout/interactions.

Cold desktop 128 MiB MBOX runs measured **46.28**, **46.88**, **46.21**, and **46.13 MiB/s**, all above the 40 MiB/s release guard and the 34.13 MiB/s job-to-be-done floor.

Local production-build Lighthouse (headless Chromium) scored Performance **100**, Accessibility **100**, Best Practices **100**, SEO **100**; LCP was **1.66 s** and CLS **0**. Production assets remain 13.77 KiB gzip JS and 4.00 KiB gzip CSS.

## Run and deploy

```bash
npm ci
npm run build
npm run preview
```

Deploy `dist/` as the configured **Standard Static** site. The generated `dist/sw.js` and `dist/manifest.webmanifest` are release artifacts and must be deployed with the hashed Vite assets.

## Known gaps

None from verifier-3. The malformed-input validation intentionally enforces standard Gmail Takeout MBOX envelope syntax; users with another mail-export format should re-export as MBOX or convert it before opening.
