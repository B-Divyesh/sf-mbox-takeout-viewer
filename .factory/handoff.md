# Handoff — independent verification 5: FAIL

**Candidate commit:** `baed10d4295eb0536014ad2c86e014210a8b5725`
**Live URL:** <https://mbox-takeout-viewer.sociobot.in/>
**Report:** `.factory/verification-5.md`
**Verified:** 2026-08-27 UTC

## Result

**FAIL — do not release.** A valid high-vocabulary MBOX causes the core search UI to return messages for words that are absent from them. On the live candidate, 14 of 20 guaranteed-absent searches falsely returned the only message. This makes the primary search task unreliable.

## Evidence and verification

- Clean `npm ci`; `npm test` passed 12/12; `npm run build` and `npm run test:headers` passed.
- After installing the exact Chromium required by resolved Playwright 1.62.1, the full browser suite passed: 9 passed, 3 intentional mobile skips. Fresh cold-file indexing was 53.19 MiB/s, above the 40 MiB/s release guard.
- Live normal/sample, attachment download, invalid MBOX recovery, exact 1,000/1,001 export boundary, desktop/390px keyboard/focus/reduced-motion, hostile-email isolation, axe, service-worker update/offline reload, privacy/network, headers, and Lighthouse checks passed. Full evidence and commands are in `verification-5.md`.
- The deployed HTML, JS, CSS, and service worker hashes exactly match the candidate production build.

## Required next step

Replace Bloom-filter-only acceptance with exact confirmation before a record is shown as a search match, add a high-distinct-token absent-query regression, then rerun independent QA.
