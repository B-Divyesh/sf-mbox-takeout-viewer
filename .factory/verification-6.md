# Independent verification 6 — PASS

**Candidate:** `0ae26d097dd1538b6c783c53449e255af814fbba` (`main`)
**Live URL:** <https://mbox-takeout-viewer.sociobot.in/>
**Verified:** 2026-08-28 UTC

## Verdict

**PASS.** This is a real local-first MBOX viewer rather than a demo. Fresh testing confirms streamed local indexing, accurate full-text candidate confirmation, reading, safe HTML handling, attachment download, EML ZIP export, gzip reading, invalid-file recovery, responsive keyboard use, offline shell reload, and the free/bulk-export boundary. The deployed bytes exactly match a clean local production build of the candidate.

No product defects were found. The preceding verifier's Bloom-filter false-positive P1 is fixed: the live app returned zero results for five known-absent terms in a 5,000-distinct-token message, and found a real term that lay beyond the compact preview.

## Clean checkout and quality gates

The worktree was clean at the requested SHA. I removed untracked generated material with `git clean -xfd`, then ran:

```text
npm ci                 PASS — 173 packages installed; 0 vulnerabilities
npm test               PASS — 4 files, 13 tests
npm run build          PASS — TypeScript check, Vite production build, release SW; dist/ generated
npm run test:headers   PASS — hashed-cache and security-header contract
npm run test:e2e       PASS — 11 passed, 3 intentional mobile skips
```

The first E2E invocation correctly failed before application execution because the lockfile resolves Playwright 1.62.1 but the supplied browser cache had another revision. I ran `npx playwright install chromium` for its exact Chromium 1234 revision and reran the full suite; Playwright's `test-results/.last-run.json` records `status: passed`. There is no lint script; the exact production build runs the repository's available TypeScript check.

The automated browser suite covers normal desktop and 390px flows, keyboard return focus, axe, 128 MiB indexing throughput, full-text Bloom regression, gzip seeking, malformed input, release cache identity, and offline reload. Its desktop throughput guard is `>40 MiB/s`, above the brief's `34.13 MiB/s` floor for 20 GiB in ten minutes.

## Independent live-browser evidence

- Desktop normal path: **Try a tiny sample** indexed two messages; `tiny local` returned `1 of 2`; opening the message rendered its text; Back returned focus to its originating result; selecting it downloaded `paper-trail-sample.mbox-selection.zip`.
- Attachment path: the sample HTML mail exposed and downloaded `note.txt`.
- Gzip path: a constructed valid `takeout.mbox.gz` indexed two records and opened the second body (`found after gzip`).
- Invalid input: an extension-valid file without an MBOX envelope stayed on the usable welcome screen and announced: “This is not an MBOX archive: it must start with a 'From ' envelope line … unzip the download and choose the .mbox file.”
- Search repair: a valid one-message MBOX with `uniquetoken00000` through `uniquetoken04999` returned `0 of 1 messages` for `definitelyabsent0000` through `definitelyabsent0004`, and `1 of 1 messages` for present `uniquetoken01234`.
- Security: a mail containing script, iframe, external image, and `javascript:` link rendered an iframe with **0** scripts, nested iframes, HTTPS images, or JavaScript links; it made **0** requests to `example.test`; no console or page errors occurred.
- Export boundary: 1,000 selected records downloaded `boundary-1000.mbox-selection.zip` without a license dialog. 1,001 selected records opened the explicit one-time bulk-unlock dialog and did not export. The dialog states `$19 USD, one time`, Sociobot/Dodo merchant of record, purchase restore, and privacy/terms links.
- Axe (reader, live): **0 serious/critical** findings. The live DOM has title, `lang=en`, one h1, main, and a skip link.
- Keyboard/mobile: at 390×844, the first Tab reaches “Skip to main content”; Tab reaches **Try a tiny sample** and Enter activates it. Its focus outline is `3px solid`; with reduced motion it reports `0.00001s` transition duration. After indexing, `scrollWidth === innerWidth === 390`. Visual review at desktop and 390px confirms the risograph archive treatment remains legible and does not crowd the mobile primary actions.
- PWA/offline: the live app installed controller `sw.js`, cache `paper-trail-shell-63dc420d91804cce`; an offline reload returned the welcome app shell, and the offline event displayed the local-archives banner. The byte-matched worker has release-named caching, `skipWaiting`, `clients.claim`, asset precaching, and the client contains the update-available toast branch. The deterministic update/cache contract also passed in the repository E2E suite. A live new-release toast cannot be forced without altering deployment, which is out of scope for verification.
- Privacy/network: normal use observed only `https://mbox-takeout-viewer.sociobot.in` requests. There are no analytics or third-party runtime requests; static CSP allows only the optional Sociobot license endpoint in `connect-src`.

## Deployment identity, policies, and budgets

Fresh SHA-256 comparisons between the clean `dist/` and HTTPS production response match exactly:

```text
index.html                  63dc420d91804ccee381b4193ca8d8c343cbcc88fffc5f724ecd415891ee97c6
assets/index-C6EqJmRY.js   18e81a1374e45beb7c31d14f09c75a1156c9d260472a6f8aaacae7c85ec7e071
assets/index-Csjz8eFL.css  af7578b16aff7f92262bc7b4eeb3f474e20462eb376d700040ec88585b45c8fd
sw.js                       24679efd6a4f72bc7312e3f11c0254acda69e229ff6f2bac7560758cb7761151
```

- Root and `sw.js`: HTTPS 200, `Cache-Control: no-cache`.
- Hashed JS/CSS: HTTPS 200, `Cache-Control: public, max-age=31536000, immutable`.
- Live responses include HSTS, restrictive same-origin CSP, Permissions-Policy, Referrer-Policy, `X-Frame-Options: DENY`, and `X-Content-Type-Options: nosniff`. `/privacy`, `/terms`, manifest, and offline fallback all return 200.
- Production payload: app JS **14,171 B gzip**, CSS **4,018 B gzip**, worker **6,890 B raw**, hero WebP **128,146 B**; all are within the static/PWA budgets and no web fonts are loaded.

I attempted a fresh Lighthouse 13.4.1 run. It first could not discover Playwright Chromium; with the explicit Chromium 151 path it ended with `Connection closed`, and with the supplied Chromium 145 path it ended `Browser tab has unexpectedly crashed`, before a report was produced. This is a verifier-tool/browser compatibility limitation, not evidence of a product failure; it is recorded here rather than substituting historical scores for fresh measurements.

## Defects by severity

None found.

## Verification limitations / next step

The only limitation is the failed fresh Lighthouse invocation described above. Re-run Lighthouse in a compatible Chrome environment if a new numerical score is required; all other requested product, deployment, PWA, privacy, accessibility, browser-error, response-policy, and budget checks passed from fresh evidence.
