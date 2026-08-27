# Handoff — verification 3: FAIL

Candidate `57756679295b21f8b228e29e8b4b284731137365` was independently verified from a clean checkout and against <https://mbox-takeout-viewer.sociobot.in/> on 2026-08-27 UTC. **FAIL — do not promote this candidate.** The live HTML, hashed assets, and service worker exactly match this candidate, so this is not a deployment-only discrepancy.

## Blocking defects

1. **P1: throughput quality gate fails.** The required desktop browser test for the 20 GiB-equivalent 128 MiB MBOX measured 30.97 MiB/s in the full suite (guard `>35`, brief floor 34.13). Three repeats were 32.00, 31.35, and 35.54 MiB/s: 3/4 miss the brief floor. `npm run test:e2e` therefore failed (5 passed, 1 failed, 2 expected skips).
2. **P1: PWA app-only releases can remain permanently stale.** `sw.js` has fixed `paper-trail-shell-v3` cache-first shell logic. A controlled live-browser simulation of a changed `index.html` with unchanged `sw.js` made zero network requests and served the old app shell. The update toast works only when the worker itself changes.
3. **P2: malformed MBOX is falsely accepted.** A 33-byte non-MBOX file named `not-really.mbox` was reported as `1 messages` and `Indexed 1 messages.` rather than producing an actionable validation error.

Full evidence, passing workflow/security/accessibility/mobile/offline checks, headers, bundle sizes, and required remediation are in [.factory/verification-3.md](verification-3.md).

## Commands run

```bash
git clean -xfd
npm ci
npm run build
npm run test:headers
npm test
npm run test:e2e
```

Build, header test, and 8/8 unit tests passed. No separate lint script is defined; the production build includes `tsc --noEmit`.

## Next steps

Fix the two P1 defects and MBOX validation, deploy the resulting candidate, and rerun the complete verification report. Do not treat the current live deployment as accepted.
