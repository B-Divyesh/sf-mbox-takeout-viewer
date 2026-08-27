# Handoff — independent verification 4: FAIL

**Candidate:** `110dbf14cee44cbe5b1479df749716720e8f0257`

**URL:** <https://mbox-takeout-viewer.sociobot.in/>
**Verdict:** **FAIL**

The live deployment exactly matches the candidate production build, and functional, privacy, security-header, accessibility, offline, and service-worker update checks pass. The release is blocked by reproducible indexing performance failure: fresh cold browser measurements on the repository's deterministic 128 MiB MBOX were **30.88**, **33.37**, **30.97**, and **31.05 MiB/s**. This misses the brief's 20 GiB / <10 minute requirement (**34.13 MiB/s**) and the candidate's own **>40 MiB/s** gate. The full production E2E suite is **8 passed, 3 skipped, 1 failed** (throughput).

Run verification with:

```bash
npm ci
npm run build
npm run test:headers
npm test
npx playwright install chromium
npm run test:e2e
```

See [verification-4.md](verification-4.md) for exact commands, artifact hashes, headers/caching evidence, live product checks, PWA update/offline evidence, accessibility/performance measurements, and remediation. No product source was changed by this verification.
