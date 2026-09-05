# Repair 6 handoff

## Release identity

- **Implementation SHA:** `333d1fb09f6818d6eac3c665a257382290002d45` (`fix: close review two findings`).
- **Live URL:** <https://mbox-takeout-viewer.sociobot.in>
- **Deployment:** production static deployment completed on 2026-09-05 UTC. The live HTML, service worker, JavaScript, and CSS hashes exactly match the clean local `dist/` build of the implementation.
- **Documentation:** this handoff is committed separately after the implementation so it does not change the deployed product artifact.

## What changed

- Replaced the unexplained backup action with **Restore a saved archive backup** and adjacent help explaining that it restores Paper Trail’s saved message list.
- Reworked the `local-network` claim test around a uniquely named, user-supplied local MBOX. It indexes, searches, opens, and exports that archive while asserting every request is same-origin and none contains the archive name, body, or query.
- After reader parsing completes, route focus now moves to the new message `<h1>` and the polite route announcement contains the selected subject.
- Rebuilt the direct static `/404` with the shared skip link, Paper Trail header, Demo/Privacy navigation, legal footer, canonical URL, Open Graph, Twitter metadata, responsive/dark/reduced-motion styling, and a plain-language h1.
- Added outcome-based browser coverage for the backup explanation, real-archive privacy path, forward reader focus/announcement, and static 404 structure/metadata/accessibility.
- Replaced the stale footer build SHA with the accurate `version 1.0.0` label.

## Earlier findings

- Review 1 demo isolation, direct `/demo`, storage namespace, reset/start-real controls, claim registry, route handling, legal pages, response policy, input recovery, search confirmation, cache identity, and throughput regressions remain covered by the existing product implementation and test suite.
- Review 2 F-2-1 through F-2-4 are addressed by the changes above. No earlier finding remains open.

## Clean verification

From the committed tree:

```text
npm ci                         passed; 0 vulnerabilities
npm test                       passed; 13 tests
npm run build                  passed; dist/ produced
npm run test:headers           passed
npm run test:e2e               passed; 23 passed, 1 intentional mobile skip
8 registered claim commands    passed individually on desktop Chromium
```

The build emitted 15.01 kB gzip JavaScript, 4.13 kB gzip CSS, and a 6.89 kB worker. The 64 MiB scanner regression passed above the 20 GiB target rate.

`@axe-core/playwright` reported zero serious/critical issues in the automated landing and static-404 tests, and again on live desktop, phone, and direct 404 pages. `verify-url.sh` passed live root and `/404` with no console errors, title/lang/main, one h1, and complete image alt checks. The standalone `@axe-core/cli` could not launch because its bundled ChromeDriver supports Chrome 152 while the supplied Playwright Chromium is 145; the supported Playwright axe integration was used instead.

## Live verification

- Fresh desktop and 390×844 phone contexts read the first screen without scrolling as: **Search your Gmail Takeout archive**; for people finding one needed email; first action **Try it with sample data**. The action was above the fold in both contexts.
- Direct `/demo` showed the persistent **Demo — sample data, nothing is saved** banner and three-message sample. Reset restored the sample; Start for real removed `demo:paper-trail-index`.
- Opening the sample’s recovered message focused its `h1` and announced the subject. Live demo requests remained same-origin, with no console errors. A fresh service-worker-controlled context reopened `/demo` offline.
- Direct `/404` returned the product page with title `Page not found — Paper Trail`, shared chrome, canonical URL, Open Graph/Twitter metadata, and zero serious/critical axe results.
- Live hashes matched local `dist/`: `index.html` `97f965b75ccdf59c…`, service worker `0f532d29ad3efbdf…`, app JavaScript `81c3885bd0c79dda…`, and CSS `337e4ec17ccb0687…`. Root and worker are `no-cache`; hashed assets are one-year immutable. CSP, HSTS, frame protection, referrer policy, and Permissions Policy are present.

## Product use and follow-up

Paper Trail is for Gmail Takeout owners who need to find, read, or export messages without uploading their archive. Start with **Try it with sample data**, then choose **Start for real** before opening a personal archive.

There are no known product gaps from this repair. The browser scanner regression is a representative 64 MiB benchmark rather than a generated 20 GiB fixture; continue tracking real-world multi-GB archive performance as the product evolves.
