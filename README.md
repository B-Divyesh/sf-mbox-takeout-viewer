# Paper Trail — Gmail Takeout MBOX viewer

Paper Trail is an installable, local-first web app for people with multi-gigabyte Gmail Takeout archives. It streams `.mbox` and `.mbox.gz` files from disk, builds a searchable index in IndexedDB, safely renders MIME messages, downloads attachments, and exports selected originals to an EML ZIP. No mail, filenames, or searches are uploaded.

Live product: <https://mbox-takeout-viewer.sociobot.in>

## What works

- Memory-bounded MBOX and gzip scanning in a dedicated Web Worker
- Header and text-preview search, sender/date/attachment filters, and sorting
- Persisted indexes with File System Access reconnection where supported
- Plain-text and sandboxed, sanitized HTML email reading
- MIME attachment downloads and original EML/ZIP export
- CSV index export, responsive keyboard UI, and offline app shell
- Free exports up to 1,000 messages; a Sociobot one-time license unlocks larger ZIPs

Uncompressed `.mbox` files support direct byte seeking. Gzip streams cannot be randomly accessed by browser APIs, so opening a result in `.mbox.gz` re-decompresses from the beginning up to that message. For repeated work on very large exports, extract the `.mbox` first. A compact Bloom index covers words throughout each raw message while a 64 KB parse window supplies headers and previews; exact phrase matching is limited to the retained preview.

## Run locally

```bash
npm ci
npm run dev
```

The dev server prints its local URL. Use **Try a tiny sample** to exercise indexing without a Takeout file.

## Verify and build

```bash
npm test          # parser, MIME, filename, and ZIP unit tests
npm run build     # type-check and produce ./dist/index.html
npm run test:e2e  # desktop + 390 px browser, axe, console, offline reload
```

The exact deployment command is `npm run build`; deploy the generated `dist/` directory as a static site. It contains the web manifest, generated icons, service worker, offline fallback, privacy policy, and terms.

## Architecture and privacy

The runtime is Vite + vanilla TypeScript with no production dependencies. The worker records byte offsets and bounded searchable previews; the main thread only reads a full message when the user opens or exports it. IndexedDB holds the reusable index, while a persisted file handle may be stored on supporting browsers. Email HTML is scrubbed, remote images and active elements are removed, a restrictive Content Security Policy is injected, and content is displayed in an origin-isolated sandboxed iframe.

License verification is the only optional application API call and goes to the Sociobot billing engine. See [`public/privacy/index.html`](public/privacy/index.html) and [`public/terms/index.html`](public/terms/index.html). The visual system and generated-art provenance are in [`.factory/design.md`](.factory/design.md).

## Browser support

Current Chrome, Edge, Firefox, and Safari are supported for `.mbox`. Chromium browsers provide the best reconnect experience through File System Access. Gzip requires the browser `DecompressionStream` API; otherwise extract the archive first.

MIT licensed. See [LICENSE](LICENSE).
