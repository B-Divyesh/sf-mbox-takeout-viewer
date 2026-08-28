# Handoff — independent verification 6

**Verdict: PASS**
**Candidate:** `0ae26d097dd1538b6c783c53449e255af814fbba`
**Live URL:** <https://mbox-takeout-viewer.sociobot.in/>
**Verified:** 2026-08-28 UTC

The public deployment is byte-for-byte the clean production build of the candidate. Clean install, unit tests, production build/type check, header check, and full Playwright suite pass. Fresh live evidence covers MBOX and gzip indexing, accurate high-vocabulary search, safe HTML mail, attachment and EML ZIP downloads, malformed-file recovery, 1,000/1,001 export boundary, keyboard/390px/reduced-motion behavior, axe serious/critical findings, PWA offline reload, privacy/network requests, caching, CSP, and security headers.

No defects were found. Full evidence and hashes are in `.factory/verification-6.md`.

Run locally:

```bash
npm ci
npm test
npm run build
npm run test:headers
npx playwright install chromium  # required if the lockfile browser is absent
npm run test:e2e
```

Known verification limitation: Lighthouse 13.4.1 crashed against both available Playwright Chromium revisions before producing a fresh report. The product's delivered bundle budgets were measured directly and all other checks passed; rerun Lighthouse in a compatible Chrome environment only if a new numerical score is required.
