# Search Gmail Takeout archives — independent verification 7 — FAIL

**Implementation reviewed:** `333d1fb09f6818d6eac3c665a257382290002d45` (`fix: close review two findings`)  
**Documentation reviewed:** `f86aaedefff99d888a5448af2faed52caaa2e57b` (`docs: record repair handoff`)  
**Live URL:** <https://mbox-takeout-viewer.sociobot.in>  
**Verified:** 2026-09-05 UTC

## Verdict

**FAIL.** The actual MBOX viewer is deployed and its declared claims, core viewer paths, privacy boundary, PWA reload, and prior review repairs pass. Three current contract findings remain: the paid unlock does not disclose its price or precise entitlement, its public license claim has no registered observable test, and the Privacy/Terms footers omit the required build/version label. There is one untested public claim. The required verdict threshold is zero findings and zero untested claims.

## First read

Before scrolling, on desktop and a fresh phone browser, this is a tool to **search a Gmail Takeout archive**. It is for **people finding one needed email**. The first action is **Open your Takeout archive**; the one-click sample is available from the landing screen and opens an immediately populated three-message inbox.

## Findings

### F7-1 — Major: the optional paid unlock has no exact price or clear scope

The live **Bulk archive export** dialog says only “A license can expand bulk export options. The checkout page shows the current terms.” The Terms page similarly says that a one-time license “may remove” the bulk-export limit. Neither location gives the exact one-time price or plainly says the entitlement (for example, export more than 1,000 selected messages). This does not meet the paid-unlock contract requiring the product page to state price, what the one-time purchase includes, and its scope before checkout.

Live boundary evidence confirms that the feature is real: exactly 1,001 selected messages opened this dialog with “Exporting 1,001 messages needs the one-time bulk unlock”; the free path is therefore materially affected by the missing disclosure.

### F7-2 — Major: the public bulk-license statement is not in the claim registry

The visitor-facing statements that a one-time license can remove/expand the bulk-export limit are public product claims. `.factory/claims.json` has eight entries, but none covers the bulk limit, the 1,000/1,001 boundary, or the paid entitlement. The full browser suite also has no tagged `@claim:` test for it. The live 1,001-message exercise above shows the boundary dialog, but it is not the required registered clean-demo assertion and does not turn the claim into a tested claim.

**Untested public claims: 1.**

### F7-3 — Minor: static legal footers omit the required version/build label

`/privacy/` and `/terms/` have the expected Paper Trail one-liner, legal links, and “Built by Param Factory”, but neither footer has a version or build identifier. The route skeleton contract requires that footer item on every route. Root and `/404` display `version 1.0.0`, so this is a static-page omission rather than an unavailable release identifier.

## Clean checkout and declared claims

From the clean checkout at the documentation SHA:

```text
npm ci             PASS — 174 packages installed; 0 vulnerabilities reported
npm test           PASS — 13 tests in 4 files
npm run build      PASS — TypeScript check, Vite build, release-specific service worker
npm run test:headers PASS — cache and response-policy contract
npm run test:e2e   PASS — 23 passed, 1 intentional mobile skip
```

Every declared command in `.factory/claims.json` was then run separately on desktop Chromium and passed:

| Claim ID | Result |
| --- | --- |
| `demo-isolation` | PASS |
| `local-network` | PASS |
| `no-tracking` | PASS |
| `message-reading` | PASS |
| `archive-search` | PASS |
| `email-export` | PASS |
| `attachment-download` | PASS |
| `offline-reload` | PASS |

The registry is complete for those eight claims. F7-2 is the additional unregistered public paid-license claim.

## Live browser evidence

- Fresh 1440×900 desktop and phone contexts returned 200 with `lang="en"`, one `h1`, a `main` landmark, the expected title, no horizontal overflow at 390 CSS px, and no console errors. The desktop headline was `Search your Gmail Takeout archive`; its supporting sentence named the audience and outcome in plain language.
- `/demo` immediately rendered the realistic three-message sample and the persistent `Demo — sample data, nothing is saved` banner. It used only `demo:paper-trail-index`. **Reset demo** restored the sample. **Start for real** removed that demo database and returned to `/` without reading it.
- A locally supplied valid MBOX indexed, searched, opened, and rendered its private body. Its message heading received focus and was announced; browser Back restored archive-heading focus. Captured requests remained same-origin and did not contain the selected archive values. An extension-valid non-MBOX was rejected with clear envelope/recovery guidance; the welcome screen remained usable. A valid `.mbox.gz` indexed and opened successfully.
- Demo attachment download and selected-message ZIP export passed through their registered claims. The live 1,001-message boundary opened the bulk-unlock dialog instead of exporting.
- A service-worker-controlled fresh context reopened `/demo` while offline. The live root and direct designed `/404` had zero serious/critical axe findings; the same was true for `/privacy/`, `/terms/`, and an unknown route. Direct `/404` had Paper Trail header/footer, title, canonical, Open Graph/Twitter metadata, and a usable return action. Its HTTP 200 response is the deliberate static route; it is not a broken page.
- Keyboard smoke: first Tab reached the skip link with a visible `4px` tomato focus outline. Reduced-motion emulation reported `scroll-behavior: auto` and the stylesheet disables transitions/animation. No third-party requests occurred in the demo or real-archive checks.

## Deployment identity and policies

The deployed artifact exactly matched the clean local production build of `333d1fb`:

```text
index.html                         97f965b75ccdf59cdeb5719f3cdaf6b6b0e66a5ad3ab5305b56f3b64a240e825
sw.js                              0f532d29ad3efbdfa20ad62bf5819148dc679d8d6d805d310da2cfa7e77538fd
assets/index-C6FZuXLj.js          81c3885bd0c79ddafc1ed2ffffff2194ea1e3344b4fcba66d94b421276486844
assets/index-BEWsfrUs.css         337e4ec17ccb06872ce8cd95a4cbfea083e0cd77c10860b7c3c1d062b2898aac
```

Root and service worker are `no-cache`; hashed assets are one-year immutable. Live responses include HSTS, CSP with `frame-ancestors 'none'`, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, Referrer-Policy, and Permissions-Policy. `/`, `/demo`, legal pages, manifest, offline page, sitemap, and the designed 404 all loaded successfully.

The current deterministic 64 MiB scanner regression passed above its 35 MiB/s guard, which exceeds the brief’s 34.14 MiB/s 20-GiB/10-minute floor. The worker/scanner files are unchanged from the earlier accepted performance repair.

## Earlier finding disposition

| Earlier item | Current disposition |
| --- | --- |
| Review 1 B1/B4 (direct isolated demo and documentation) | Fixed and rechecked live. |
| Review 1 B2 and Review 2 F-2-2 (claim registry and real-archive privacy proof) | Fixed for the eight listed claims; the separate paid claim remains F7-2. |
| Review 1 B3 and Review 2 F-2-3 (routes, Back, forward focus/announcement) | Fixed and rechecked with a local archive. |
| Review 1 M1 and Review 2 F-2-4 (metadata/shared direct 404) | Fixed and rechecked. F7-3 is a newly observed legal-footer detail. |
| Review 1 M2 and Review 2 F-2-1 (plain first screen/backup explanation) | Fixed and rechecked. |
| Verifications 1–4 (throughput, invalid-MBOX handling, release cache/policy) | Current scanner guard, invalid-file recovery, release-named worker, artifact hashes, and headers pass. |
| Verification 5 (Bloom false positives) | Current exact candidate confirmation suite passes; normal local search returned only the actual match. |
| Verification 6 (normal viewer/PWA/accessibility paths) | Rechecked and passing as described above. |

## Required follow-up

1. Put the exact current one-time price and the precise bulk-export entitlement on the product page/dialog and Terms page.
2. Add one `claims.json` entry and one tagged clean-demo test for the free/paid export boundary and the observable licensed entitlement; then run that command independently.
3. Add the same version/build label to the Privacy and Terms footers.
4. Re-run this verification. A PASS requires zero findings and zero untested claims.
