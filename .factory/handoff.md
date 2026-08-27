# Handoff — Paper Trail repair

## Independent-verifier remediation: **ready for deploy**

Repaired the three findings from verifier report commit `a335f48a1764df133289d8b92ca68efd592ac85b` against candidate `e45847886e8ca0dc02bd52cdcd305cc2974c2dcf`:

- The MBOX worker now uses a numeric, allocation-bounded scanner instead of per-byte strings and growing arrays. It retains a 64 KiB rendering prefix and a compact searchable Bloom index through the first 192 KiB of each message (including words beyond the preview), avoiding disproportionate work for giant attachments and quoted threads. A deterministic 128 MiB in-browser MBOX guard requires more than **35 MiB/s**, above the 34.14 MiB/s needed for 20 GiB in ten minutes; it passed on the verifier desktop Chromium profile. The worker stays local-only and memory-bounded.
- Reader return now stores the originating record ID and focuses the newly rendered matching result button, instead of focusing a detached pre-render element. Desktop and mobile E2E cover the keyboard return.
- Added deployable static-host `_headers` rules: content-hashed JS/CSS get `Cache-Control: public, max-age=31536000, immutable`; HTML and the service worker revalidate. The service-worker cache namespace is bumped to `paper-trail-shell-v3` so an update installs a fresh shell.

## What shipped

- A production Vite + vanilla TypeScript PWA for streamed `.mbox` and `.mbox.gz` archives.
- A dedicated Web Worker detects MBOX boundaries without loading the file wholesale. It saves message byte ranges, headers, previews, and a compact whole-message word Bloom index in IndexedDB. The Bloom/index representation is deliberately bounded; the raw file is never copied into browser storage.
- Search by message words, sender, dates, attachment presence, and archive/newest/oldest order; 80-row pagination; selection by message or page.
- On-demand MIME parsing for plain text, HTML, multipart messages, RFC 2047 headers, quoted-printable/base64 transfer encoding, and common character sets.
- HTML mail is stripped of active elements and handlers, remote images are blocked, a restrictive CSP is injected, and the result is displayed in a sandboxed iframe without same-origin permission.
- Attachment download, original single-message EML download, selection EML ZIP, CSV index export, and reusable JSON index backup/import.
- Persisted archive indexes and File System Access handles where available, plus explicit reconnect behavior on browsers that cannot retain handles.
- A complete loading/indexing state, no-match state, storage-quota error path, offline banner/fallback, cancellation, keyboard focus return, mobile layout, and update notice.
- PWA manifest, 192/512/maskable icons, versioned app-shell service worker, and offline navigation behavior.
- Sociobot one-time license integration: `$19 USD` copy, hosted checkout link, return-token capture, daily verification cache, optimistic offline unlock, paste-to-restore, and a free 1,000-message ZIP threshold. No product ID or payment provider is embedded.
- Product-specific “Paper Trail” risograph visual system, original generated hero artwork and provenance, privacy policy, terms, sitemap, robots, and llms metadata.

## Run and deploy

```bash
npm ci
npm run dev
npm test
npm run build
npm run test:e2e
```

The factory build command is exactly `npm run build`. Static output lands in `dist/`, with `dist/index.html` at its root.

## Verification completed

- `npm ci`: clean install passed (174 packages, 0 vulnerabilities).
- `npm test`: 8/8 passing. This includes deterministic scanner boundary/search coverage and a 64 MiB throughput guard.
- `npm run build`: passes; `dist/` produced. App JS is 37.29 KB raw / 13.77 KB gzip, worker 5.67 KB raw, CSS 14.01 KB raw / 4.00 KB gzip; initial JS remains far below 200 KB.
- `npm run test:e2e`: 6 passing, 2 expected mobile skips. Desktop covers the deterministic 128 MiB >35 MiB/s target, focus restoration, gzip seek, axe, console, and offline reload. The 390×844 mobile project covers the core reader/focus path and offline reload.
- `npm run test:headers`: passed, verifying built content-hashed JS/CSS and the immutable header rules.
- Local production-preview inspection: title, `lang=en`, one initial `<h1>`, main landmark, and `_headers` all present; no console errors in the E2E flows.
- Axe browser audit: zero serious or critical violations in the reader path on desktop and mobile.
- Lighthouse mobile (local production preview): Performance **99**, Accessibility **100**, Best Practices **100**, SEO **100**; LCP 2.1 s, TBT 0 ms, CLS 0.
- Offline test: service worker installed and controlled the page; Chromium context was taken offline and the complete interactive landing shell reloaded from Cache Storage on desktop and mobile.
- Pre-deploy live check confirmed the currently deployed candidate still has the verifier's short cache header. Recheck the deployed hashed JS/CSS after this commit publishes; expected header is `public, max-age=31536000, immutable`.

## Important behavior and known gaps

- Uncompressed MBOX messages use immediate byte-range reads. Browser gzip streams are not seekable; opening/exporting a gzip result re-decompresses from byte zero until the desired message. The UI recommends extracting frequently used large gzip archives first.
- Whole-message search uses a 1 KB Bloom filter per message to remain memory-bounded. It covers headers and the first 192 KB of raw ASCII word tokens, which includes body text beyond the 64 KB display preview. It can produce false positives; exact phrase/substrings are checked in the retained preview. Content after that bound, including huge attachments, is deliberately not semantically indexed so the 20 GiB throughput target remains sustainable.
- The deterministic 128 MiB browser guard is a scalable proxy for the real 20 GiB target. Actual duration still varies with local browser, disk, message count, and compression mix.
- ZIP creation uses the browser’s Blob implementation and therefore needs memory proportional to the selected raw messages. The UI confirms exports over 100 messages. A future version should stream ZIP output directly to a user-selected file on Chromium.
- MIME support covers normal Gmail Takeout mail and common multipart/encoding cases, not encrypted S/MIME/PGP bodies, TNEF, or every malformed legacy charset. Original EML export remains lossless even when display decoding is incomplete.
- Per-message Print / Save PDF is available through the browser. Batch PDF conversion is intentionally not advertised or sold in v1.
