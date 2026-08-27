# Handoff — Paper Trail v1

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

- `npm test`: 5/5 passing (MIME, RFC 2047, searchable indexing, Bloom word index, safe filenames, ZIP structure).
- `npm run test:e2e`: 5 passing, 1 intentionally skipped duplicate mobile gzip case. Desktop and 390×844 mobile cover worker indexing, search, reading, EML ZIP download, axe, console, offline reload; desktop additionally covers streamed gzip indexing and seeking.
- `npm run build`: passes from the lockfile; app JS 37.19 KB raw / 13.74 KB gzip, worker 3.76 KB, CSS 14.01 KB raw / 4.00 KB gzip. Hero WebP is 128 KB. No runtime dependencies or CDN assets.
- Factory `verify-url.sh`: HTTP 200, 625–771 ms local load, zero console/page errors, title present, `lang=en`, exactly one `h1`, main landmark present, zero images missing alt, zero unlabeled buttons.
- Axe browser audit: zero serious or critical violations in the full message-reader path on desktop and mobile.
- Lighthouse mobile (local production preview, headless Chromium): Performance 100, Accessibility 100, Best Practices 100, SEO 100; LCP 1.7 s, TBT 0 ms, CLS 0, Speed Index 0.9 s.
- Offline test: service worker installed and controlled the page; Chromium context was taken offline and the complete interactive landing shell reloaded from Cache Storage on desktop and mobile.
- Visual review: 1440 px landing/workspace and 390 px landing screenshots checked for clipping, hierarchy, generated-image artifacts, and target sizing.

## Important behavior and known gaps

- Uncompressed MBOX messages use immediate byte-range reads. Browser gzip streams are not seekable; opening/exporting a gzip result re-decompresses from byte zero until the desired message. The UI recommends extracting frequently used large gzip archives first.
- Whole-message search uses a 1 KB Bloom filter per message to remain memory-bounded. It can produce occasional false-positive results and searches raw ASCII word tokens; exact phrase/substrings are checked in the retained 64 KB parse window. Base64-encoded body text beyond that window cannot be semantically indexed without material storage cost.
- The architecture is sized for multi-GB files, but a real 20 GB Takeout fixture was not available in the disposable worker, so the brief’s “under 10 minutes” target was not empirically benchmarked. Browser, disk, message count, and attachment mix will materially affect it.
- ZIP creation uses the browser’s Blob implementation and therefore needs memory proportional to the selected raw messages. The UI confirms exports over 100 messages. A future version should stream ZIP output directly to a user-selected file on Chromium.
- MIME support covers normal Gmail Takeout mail and common multipart/encoding cases, not encrypted S/MIME/PGP bodies, TNEF, or every malformed legacy charset. Original EML export remains lossless even when display decoding is incomplete.
- Per-message Print / Save PDF is available through the browser. Batch PDF conversion is intentionally not advertised or sold in v1.
