# Handoff — verification 5 repair

**Base verifier report:** `.factory/verification-5.md` at `413c6fc9d3ee7f13bba80e35fd6d290a1c1db076`  
**Repaired candidate:** `2b3d56c6ec380318b0473919de60b0ed68e5eb2f`  
**Artifact/deployment class:** Vite + vanilla TypeScript offline PWA; static `dist/` deployment  
**Verified:** 2026-08-28 UTC

## Result

PASS locally. The verifier's release-blocking false-positive search defect is repaired without changing the researched local-first product scope.

The compact 1 KiB Bloom filter now only rejects impossible records or identifies candidates. A record outside its retained exact preview is displayed only after the app reads the original local message bytes (bounded to the advertised first 192 KiB) and confirms every query term. A saved index with no connected original never displays an unverified candidate and explains that reconnecting is required. Query changes invalidate in-flight work so stale confirmations cannot populate a newer search.

## Regression coverage

- Added a unit regression with 5,000 distinct body tokens. It proves Bloom false positives exist at that density and proves byte-level confirmation rejects all 20 guaranteed-absent `definitelyabsent0000`–`0019` queries while accepting a present term.
- Added the same real browser regression: it indexes a one-message high-vocabulary MBOX, exercises all 20 absent searches, waits for local confirmation to finish, and asserts `0 of 1 messages`; it also proves an actual term beyond the 4 KiB retained preview returns `1 of 1 messages`.
- The implementation reads only the matching record's first 192 KiB, reuses the existing direct seek/decompression path, and preserves the fast streaming indexer. It does not upload the archive, query, or candidate bytes.

## Exact verification evidence

From a clean dependency install:

```text
npm ci                 PASS — 173 packages installed; 0 vulnerabilities
npm test               PASS — 4 files, 13 tests
npm run build          PASS — TypeScript, Vite, release SW; dist/ generated
npm run test:headers   PASS — immutable hashed-asset and security-header contract
npm run test:e2e       PASS — 11 passed, 3 intentional mobile skips
```

- Browser throughput: deterministic cold 128 MiB MBOX indexed at **72.87 MiB/s**, above the repository guard of 40 MiB/s and the brief floor of 34.13 MiB/s.
- Browser coverage included desktop and 390×844 mobile sample indexing/search/read/export, keyboard Enter activation and reader-return focus, axe serious/critical smoke coverage, malformed-MBOX recovery, gzip streamed seek/read, service-worker offline reload, and deterministic app-only cache/release identity. The new high-vocabulary regression passed on both projects.
- Local 390px smoke: `scrollWidth === innerWidth === 390`, focus outline was 3px, and no console errors occurred.
- Security/privacy smoke: a hostile HTML mail had scripts, iframes, external `example.test` media, and `javascript:` links removed from the sandbox `srcdoc`; normal sample use made requests only to the local same origin and logged no console errors.
- Lighthouse against the fresh production preview: Performance **99**, Accessibility **100**, Best Practices **100**, SEO **100**; LCP **2,074 ms**, TBT **0 ms**, CLS **0**.
- Production artifact emitted `assets/index-C6EqJmRY.js` (14.16 kB gzip), `assets/index-Csjz8eFL.css` (4.00 kB gzip), and `assets/indexer.worker-DI1aZiPc.js` (6.89 kB raw). The release-specific service-worker cache is `paper-trail-shell-63dc420d91804cce`.

## Deployment and live identity

Push this repair and deploy the generated `dist/` directory using the repository's static deployment configuration (`public/staticwebapp.config.json`). After propagation, verify the live root, hashed JS/CSS, and `sw.js` SHA-256 against this build, then run the controlled offline/update smoke on `https://mbox-takeout-viewer.sociobot.in/`.

## Known gaps / next steps

There are no known release blockers. The intentionally skipped mobile cases are the repository's CPU-heavy desktop throughput, build-artifact, and gzip checks; the normal 390px flow, false-positive regression, offline reload, malformed-input recovery, keyboard, and axe path all passed.
