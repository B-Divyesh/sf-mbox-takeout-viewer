# Adversarial first-read review 1 — Paper Trail

**Reviewed:** 2026-08-28 UTC  
**Target:** `https://mbox-takeout-viewer.sociobot.in`  
**Method:** fresh Chromium contexts at 390 × 844 and 1440 × 900; live-site route, storage, network, and offline checks; repository tests from a clean dependency install.

## Verdict: FAIL

There are four blocking findings. The first screen is understandable, and the risograph treatment is product-specific, but the required demo is not a sandbox, has no direct URL, and the product has no claim registry. A visitor cannot safely try the promised sample flow, and a verifier cannot establish the privacy/offline/product promises.

## Cold first read

Before scrolling on both viewports, I understood this as: “A browser tool for someone with a Gmail Takeout MBOX archive who needs to find, read, or export an email without uploading the archive.” I would click **“Open an MBOX file”** for my archive, or the adjacent sample button first.

This passes the narrow first-screen comprehension check. It does **not** pass the demo or claims checks below. The mobile first screen keeps the headline, explanation, facts, and both actions above the fold. The visual identity is distinct from a generic SaaS template: the archival-paper palette, ink outlines, editorial type, and original illustration match `.factory/design.md`.

## Findings (highest severity first)

### BLOCKING B1 — The advertised sample is not a demo sandbox

**Quote:** “Try a tiny sample”

**Evidence:** In a fresh 390 px context, clicking the button immediately rendered a two-message workspace (`paper-trail-sample.mbox`, “2 messages · 990 B”). That is a useful immediate product view, but all required demo controls were absent: no “Demo — sample data, nothing is saved” banner, no **Reset demo**, and no **Start for real**. `indexedDB.databases()` then returned `paper-trail-index`, the same production database name in `src/db.ts`; it is not a `demo:` namespace. A direct `/?demo=1` visit returned the ordinary welcome screen, not sample data. `/demo` returned a generic 404.

**Why this loses or misleads a first-time visitor:** “Try” implies a reversible safe path. Here the sample is written into the normal persistent archive store, and the app starts by reading that store before the sample action. A visitor cannot tell whether stored real archives are isolated, cannot reset the trial, and cannot bookmark or share a demo URL.

**Concrete fix:** Make `/demo` (and `?demo=1`, if retained) decide demo mode before any database read. Use a separate `demo:paper-trail-index` database/keys, never read or write production keys in that mode, and delete only that namespace on **Reset demo** and **Start for real**. Keep a persistent banner exactly stating “Demo — sample data, nothing is saved”, with both controls. Rename the landing button to **“Try it with sample data”**. Seed a more representative archive with several realistic threads, attachments, search/filter results, and an export result. Add an observable clean-context test tagged `@claim:demo-isolation` that proves production IndexedDB/localStorage is untouched.

### BLOCKING B2 — Claim governance is absent; all visitor-facing promises are unlisted

**Quote:** `.factory/claims.json` is absent; `rg -n '@claim:'` found no tagged test.

**Evidence:** The requested registry does not exist, so there were no listed claim commands to run. `npm test`, `npm run build`, `npm run test:e2e`, and `npm run test:headers` pass, but none is mapped to a claim and none has the required `@claim:<id>` tag. The existing e2e suite tests some behaviour but cannot substitute for a missing registry. During a fresh sample run, captured requests were same-origin only; after a first loaded visit, an offline reload rendered the welcome h1. Those isolated observations are not a claim suite and do not establish the advertised privacy or offline guarantees.

**Why this loses or misleads a first-time visitor:** The screen asks a visitor to rely on “never,” “safe,” “offline,” browser-support, and export statements without a reproducible proof path. The strongest promises are especially important for an email archive tool.

**Concrete fix:** Add `.factory/claims.json`, one entry per claim below, and exactly one clean-demo observable test tagged `@claim:<id>` for each entry. Remove a promise if it cannot be tested. Use request interception for all local/privacy promises, an offline context for offline, and downloaded-content assertions for exports. The following are individual **unlisted claim** findings; each needs that test or removal/rewrite.

| ID | Location and exact unlisted claim | Required observable test / plain alternative |
| --- | --- | --- |
| UC-01 | Landing: “Paper Trail streams it from disk, builds a local index, and lets you search, read, and extract what matters.” | Demo scans the sample, searches it, opens a message, and asserts an exported artifact. |
| UC-02 | Landing: “No upload.” | Intercept the entire demo flow and assert no cross-origin/archive upload request. |
| UC-03 | Landing: “Your mail never crosses the network.” | Same privacy interception test, with a real locally supplied fixture as well as demo data. |
| UC-04 | Landing: “Works with .mbox and streamed .mbox.gz archives.” | Demo or shipped fixtures for both formats; assert indexed message counts and readable results. |
| UC-05 | Landing: “Resume saved indexes and export original .eml files.” | Reload/reconnect a demo index and inspect an EML download’s original bytes. |
| UC-06 | Landing: “Chrome and Edge can reconnect files after refresh.” | Browser-specific test, or remove the browser promise. |
| UC-07 | Landing: “Firefox and Safari ask you to choose the same file again.” | Browser-specific test, or remove the browser promise. |
| UC-08 | Landing: “LOCAL-ONLY INDEXING” / “ZERO UPLOAD” | Cover in the network/privacy test; remove duplicate all-caps marketing text. |
| UC-09 | Landing: “MEMORY-BOUNDED STREAMING” | Measured memory-bound fixture with an explicit limit, or remove it. |
| UC-10 | Landing: “SAFE, SANDBOXED EMAIL HTML” | Demo message containing script, remote image, and unsafe URL; assert they cannot execute/request. |
| UC-11 | Landing: “INSTALLABLE OFFLINE” | Assert installability requirements and an offline demo reload after first visit. |
| UC-12 | Landing: “The browser grants access only to that file.” | Capability/privacy test, or replace with “Choose an archive from your device.” |
| UC-13 | Landing: “A worker scans mail boundaries and searchable previews without loading the whole archive into memory.” | Measured fixture with a stated memory bound, or remove implementation detail. |
| UC-14 | Landing: “Filter messages, read safe MIME content, download attachments, or collect original messages in a ZIP.” | Demo tests for each named outcome; split into short independently tested statements. |
| UC-15 | Landing: “Private by design.” | Remove as a slogan; the tested local-data statement is the useful replacement. |
| UC-16 | README: “Paper Trail is an installable, local-first web app for people with multi-gigabyte Gmail Takeout archives.” | Installability test and a defined large-fixture performance/capacity claim, or reduce to the supported file task. |
| UC-17 | README: “It streams .mbox and .mbox.gz files from disk, builds a searchable index in IndexedDB, safely renders MIME messages, downloads attachments, and exports selected originals to an EML ZIP.” | Split into the format, persistence, HTML safety, attachment, and EML-ZIP tests above. |
| UC-18 | README: “No mail, filenames, or searches are uploaded.” | Intercept sample and supplied-fixture flows and assert request bodies/URLs contain none of those values. |
| UC-19 | README: “Memory-bounded MBOX and gzip scanning in a dedicated Web Worker” | Explicit memory ceiling and both-format test, or remove. |
| UC-20 | README: “Header and text-preview search, sender/date/attachment filters, and sorting” | Demo input/output assertions for every named filter and sort. |
| UC-21 | README: “Persisted indexes with File System Access reconnection where supported” | Persist/reload/reconnect test on a supported browser, or remove. |
| UC-22 | README: “Plain-text and sandboxed, sanitized HTML email reading” | Unsafe HTML fixture and plain-text fixture; assert displayed safe output and absent remote/script effects. |
| UC-23 | README: “MIME attachment downloads and original EML/ZIP export” | Assert downloaded attachment bytes and original EML/ZIP entries. |
| UC-24 | README: “CSV index export, responsive keyboard UI, and offline app shell” | Separate CSV download, keyboard-only task, and offline-demo reload tests. |
| UC-25 | README: “Free exports up to 1,000 messages; a Sociobot one-time license unlocks larger ZIPs” | Boundary tests at 1,000/1,001 in a demo fixture and a licensed sandbox; otherwise remove price/limit claim. |
| UC-26 | README: “Uncompressed .mbox files support direct byte seeking.” | Instrumented uncompressed fixture proving the read range. |
| UC-27 | README: “Gzip streams cannot be randomly accessed by browser APIs…” | Browser capability test, or shorten to user guidance without asserting browser internals. |
| UC-28 | README: “A compact Bloom index narrows likely matches…” | Search correctness test covering a candidate outside the preview and an absent token. |
| UC-29 | README: “Saved indexes retain their compact preview search…” | Backup/import/reconnect test with an observable search result. |
| UC-30 | README: “Current Chrome, Edge, Firefox, and Safari are supported for .mbox.” | Browser-matrix CI evidence, or name only the tested browser(s). |
| UC-31 | README: “Chromium browsers provide the best reconnect experience…” | Define and test “best”, or replace with one factual supported-capability sentence. |
| UC-32 | README: “Gzip requires the browser DecompressionStream API…” | Capability test plus a tested fallback, or remove. |

### BLOCKING B3 — Required routes, back behaviour, and 404 are broken

**Quote:** `GET /demo` returned `404` with title “Azure Static Web Apps - 404: Not found” and body “We couldn’t find that page, please check the URL and try again.”

**Evidence:** `/demo` is not deployed; `/?demo=1` is a 200 welcome screen rather than the demo. The same generic provider 404 appears at `/does-not-exist`, with no product styling, no h1, no main landmark, and no route back. In the sample flow, opening “Your first recovered message” then using the browser Back button navigated to `about:blank`; no app history state was created. The app has state-rendering functions but no route URLs, `pushState`, `popstate`, route-change focus, or route announcement.

**Why this loses or misleads a first-time visitor:** A shared/demo URL fails outright. A mobile visitor who uses the browser Back control loses the app instead of returning to results. The raw host 404 looks abandoned and gives no path home.

**Concrete fix:** Deploy a real `/demo` route with demo state, add a styled product `/404` with a single h1 and a home action, and configure the host fallback to serve it. Give meaningful views real URLs (at least `/`, `/demo`, `/archive/...`, and `/message/...`), use `pushState`/`popstate`, restore state/scroll, focus the new h1, and announce route changes in a polite live region. Add deep-link, reload, browser-back, focus, and 404 tests.

### BLOCKING B4 — The documented demo contract is missing

**Quote:** No `.factory/demo.md` exists.

**Evidence:** There is no documented demo URL, sample contents, reset mechanism, or storage namespace. This is independently blocking because the required verifier entry point cannot be discovered or repeated from a clean state.

**Why this loses or misleads a first-time visitor:** The README only says “Use **Try a tiny sample**”, which is neither a direct testable URL nor a statement of what happens to data. A reviewer cannot determine whether the trial is safe.

**Concrete fix:** Add `.factory/demo.md` documenting `/demo`, exact seeded records/files, the persistent banner, reset/start-real behaviour, and every demo storage key/database. Link the direct demo URL from the README.

### Major M1 — Metadata and shared site skeleton are incomplete

**Quote:** Root has no `rel="canonical"`, Open Graph tags, or Twitter card. `/privacy/` and `/terms/` have only viewport metadata and a back link.

**Evidence:** Root title is acceptable (“Paper Trail — private Gmail Takeout viewer”), with one h1, lang, main, favicon, and description. However, it lacks canonical/OG/Twitter metadata. Privacy and Terms have titles in the correct route pattern and one h1/main, but lack meta descriptions, canonical, OG/Twitter, favicon/theme metadata, skip link, product header/nav, and product footer. The landing header also has no visible navigation to Demo/Privacy; its external “Source” link does not say it opens GitHub. `robots.txt` and sitemap exist, but sitemap cannot list the required `/demo` route while it is absent.

**Why this loses or misleads a first-time visitor:** Legal pages look like detached documents, navigation disappears at the places where trust matters, and shared links have incomplete previews. The absent Demo route makes the site map misleading.

**Concrete fix:** Create a shared semantic header/footer for every route: skip link, linked wordmark, Demo and Privacy navigation, legal footer, build/version text, and “Source (GitHub)” if retained. Add route-specific description, canonical, OG title/description/image, Twitter card, favicon, and theme color to all static pages. Add `/demo` and designed `/404` to sitemap and verify all links at 200 (or explicit mailto/download).

### Major M2 — Copy is technically dense, duplicate, and uses a non-result-naming demo button

**Quote:** “ZERO UPLOAD · MEMORY-BOUNDED STREAMING · SAFE, SANDBOXED EMAIL HTML · INSTALLABLE OFFLINE”

**Why this loses or misleads a first-time visitor:** This is a strip of unsupported technical terms, not three plain facts. “Try a tiny sample” does not say what result will appear, and the README opens with implementation detail rather than the visitor’s job. The visitor has to know MBOX, MIME, EML, ZIP, IndexedDB, Bloom index, File System Access, and DecompressionStream before the prose becomes clear.

**Concrete fix:** Keep the good headline. Replace the lede with “Search a Gmail Takeout archive in this browser. Read messages and export the ones you need.” Replace the sample action with **“Try it with sample data”** and nearby text “Opens a sample inbox you can search and export.” Remove the all-caps strip until each fact has a claim test. Move implementation detail to a clearly labelled technical note and use one term consistently: “archive”, “index”, “message”, and “export”.

## Copy audit

Word counts use words/numbers as tokens; code blocks are excluded. To make the audit complete, headings, navigation labels, buttons, and README feature-list fragments are included as reader-visible copy. `†` marks a copy finding. Every `†` row has a concrete rewrite in the “Copy fixes” table following the audit; rows without `†` still appear here so the full copy is accounted for.

### Landing page

| Words | Exact copy | Flag |
| ---: | --- | --- |
| 4 | Your Takeout, finally readable | † context-free marketing heading |
| 7 | Find the one email in 20 GB. | — |
| 7 | Open a Gmail Takeout archive right here. | — |
| 19 | Paper Trail streams it from disk, builds a local index, and lets you search, read, and extract what matters. | † technical/jargon-heavy |
| 2 | No upload. | † unlisted claim |
| 6 | Your mail never crosses the network. | † unlisted claim |
| 7 | Works with .mbox and streamed .mbox.gz archives. | † jargon and unlisted claim |
| 8 | Resume saved indexes and export original .eml files. | † jargon and unlisted claim |
| 4 | Open an MBOX file | † unexplained format in primary action |
| 4 | Try a tiny sample | † not the required/result-naming demo action |
| 3 | Import saved index | † “index” is unexplained |
| 8 | Chrome and Edge can reconnect files after refresh. | † unlisted compatibility claim |
| 11 | Firefox and Safari ask you to choose the same file again. | † unlisted compatibility claim |
| 2 | Local-only indexing | † claim fragment/jargon |
| 2 | ZERO UPLOAD | † claim fragment |
| 2 | MEMORY-BOUNDED STREAMING | † jargon/claim fragment |
| 4 | SAFE, SANDBOXED EMAIL HTML | † jargon/claim fragment |
| 2 | INSTALLABLE OFFLINE | † claim fragment |
| 6 | From archive brick to paper trail. | † heading makes no job clear |
| 3 | Choose the archive | — |
| 10 | Pick the Takeout .mbox or .mbox.gz directly from your drive. | † unexplained format terms |
| 8 | The browser grants access only to that file. | † unlisted technical/privacy claim |
| 4 | Build a small index | † “index” unexplained; “small” vague |
| 15 | A worker scans mail boundaries and searchable previews without loading the whole archive into memory. | † implementation jargon/unlisted claim |
| 3 | Search and extract | — |
| 15 | Filter messages, read safe MIME content, download attachments, or collect original messages in a ZIP. | † MIME/ZIP jargon and unlisted safety claim |
| 3 | Private by design. | † unsupported slogan |
| 4 | Generated risograph artwork disclosed. | † context-free fragment |
| 1 | Privacy | — |
| 1 | Terms | — |
| 1 | Source | † external destination not named |

### README

| Words | Exact copy | Flag |
| ---: | --- | --- |
| 6 | Paper Trail — Gmail Takeout MBOX viewer | † format jargon before task |
| 15 | Paper Trail is an installable, local-first web app for people with multi-gigabyte Gmail Takeout archives. | † jargon/unlisted product claim |
| 28 | It streams `.mbox` and `.mbox.gz` files from disk, builds a searchable index in IndexedDB, safely renders MIME messages, downloads attachments, and exports selected originals to an EML ZIP. | † **over 22**, jargon, unlisted claims |
| 7 | No mail, filenames, or searches are uploaded. | † unlisted privacy claim |
| 2 | Live product: | — |
| 2 | What works | † heading lacks task context |
| 10 | Memory-bounded MBOX and gzip scanning in a dedicated Web Worker | † jargon/unlisted claim |
| 8 | Header and text-preview search, sender/date/attachment filters, and sorting | † feature claim/jargon |
| 9 | Persisted indexes with File System Access reconnection where supported | † jargon/unlisted claim |
| 7 | Plain-text and sandboxed, sanitized HTML email reading | † jargon/unlisted claim |
| 7 | MIME attachment downloads and original EML/ZIP export | † jargon/unlisted claim |
| 10 | CSV index export, responsive keyboard UI, and offline app shell | † jargon/unlisted claims |
| 14 | Free exports up to 1,000 messages; a Sociobot one-time license unlocks larger ZIPs | † unlisted price/limit claim |
| 7 | Uncompressed `.mbox` files support direct byte seeking. | † implementation jargon/unlisted claim |
| 23 | Gzip streams cannot be randomly accessed by browser APIs, so opening a result in `.mbox.gz` re-decompresses from the beginning up to that message. | † **over 22**, jargon/unlisted claim |
| 11 | For repeated work on very large exports, extract the `.mbox` first. | † unexplained format term |
| 38 | A compact Bloom index narrows likely matches across headers and the first 192 KB of every message (beyond the 64 KB preview); every likely hit is then confirmed against the original local bytes before it appears in results. | † **over 22**, dense implementation jargon/unlisted claim |
| 20 | Saved indexes retain their compact preview search, and ask to reconnect the original archive before checking a likely full-message hit. | † vague/jargon/unlisted claim |
| 2 | Run locally | — |
| 7 | The dev server prints its local URL. | — |
| 12 | Use **Try a tiny sample** to exercise indexing without a Takeout file. | † wrong demo label/no direct demo URL |
| 3 | Verify and build | — |
| 7 | parser, MIME, filename, and ZIP unit tests | † jargon fragment |
| 4 | type-check and produce `./dist/index.html` | — |
| 8 | desktop + 390 px browser, axe, console, offline reload | † incomplete claim verification wording |
| 17 | The exact deployment command is `npm run build`; deploy the generated `dist/` directory as a static site. | — |
| 15 | It contains the web manifest, generated icons, service worker, offline fallback, privacy policy, and terms. | † unlisted offline claim |
| 3 | Architecture and privacy | — |
| 10 | The runtime is Vite + vanilla TypeScript with no production dependencies. | † implementation detail, not user documentation |
| 24 | The worker records byte offsets and bounded searchable previews; the main thread only reads a full message when the user opens or exports it. | † **over 22**, jargon/unlisted claim |
| 16 | IndexedDB holds the reusable index, while a persisted file handle may be stored on supporting browsers. | † jargon/unlisted claim |
| 27 | Email HTML is scrubbed, remote images and active elements are removed, a restrictive Content Security Policy is injected, and content is displayed in an origin-isolated sandboxed iframe. | † **over 22**, jargon/unlisted safety claim |
| 16 | License verification is the only optional application API call and goes to the Sociobot billing engine. | † unlisted network/privacy claim |
| 4 | See [`public/privacy/index.html`](public/privacy/index.html) and [`public/terms/index.html`](public/terms/index.html). | † source-path wording is not reader-facing |
| 9 | The visual system and generated-art provenance are in [`.factory/design.md`](.factory/design.md). | † internal-path wording is not reader-facing |
| 2 | Browser support | — |
| 10 | Current Chrome, Edge, Firefox, and Safari are supported for `.mbox`. | † unlisted compatibility claim |
| 11 | Chromium browsers provide the best reconnect experience through File System Access. | † vague/unlisted compatibility claim |
| 11 | Gzip requires the browser `DecompressionStream` API; otherwise extract the archive first. | † jargon/unlisted compatibility claim |
| 2 | MIT licensed. | — |
| 2 | See [LICENSE](LICENSE). | — |

### Copy fixes for every flagged phrase/category

| Flagged copy | Rewrite or required action |
| --- | --- |
| “Your Takeout, finally readable” | “Search your Gmail Takeout archive” |
| 19-word landing lede | “Search a Gmail Takeout archive in this browser. Read messages and export the ones you need.” |
| `.mbox`, `.mbox.gz`, `.eml`, MIME, ZIP, IndexedDB, Bloom index, File System Access, DecompressionStream, Web Worker | On first mention, say what the visitor does instead: “Gmail Takeout archive”, “email file”, “saved search list”, “downloaded email archive”. Put unavoidable format/browser details in a short “File and browser support” note. |
| “Open an MBOX file” | “Open your Takeout archive” |
| “Try a tiny sample” | “Try it with sample data” |
| “Import saved index” | “Open an index backup” (and add one sentence explaining it) |
| Browser reconnect sentences | “After refresh, choose the archive again if your browser cannot reconnect it.” Only retain brand detail with the browser tests in UC-06/07. |
| All-caps trust strip | Remove until its four promises are claim-tested; then present three short sentence-case facts. |
| “From archive brick to paper trail.” | “How you search a Takeout archive” |
| “Build a small index” | “Index your archive” |
| Worker/memory sentence | “Paper Trail scans the archive without loading the whole file at once.” Retain only after a bounded-memory test exists. |
| “Filter messages, read safe MIME content…” | “Search messages, read them safely, download attachments, or export selected emails.” Split and test the safety/export statements. |
| “Private by design.” | “Your archive stays in this browser.” Retain only with UC-02/03 evidence. |
| “Generated risograph artwork disclosed.” | “Artwork source” (link to a plain provenance note). |
| “Source” | “Source (GitHub)” |
| README’s 28-word introduction | “Paper Trail searches Gmail Takeout archives in your browser. You can read messages, download attachments, and export selected emails.” |
| “What works” | “What you can do with an archive” |
| README technical feature bullets | Rewrite as tested task outcomes: “Search by words, sender, date, or attachment”; “Download an attachment”; “Export selected emails”; “Save and reopen an index.” |
| 23-, 24-, 27-, and 38-word README sentences | Split each into ≤14-word user-facing sentences. Put algorithm/API details in a separate technical reference only if needed. |
| README’s sample instruction | “Open `/demo` to search and export the sample inbox. Demo data is separate and can be reset.” |
| Internal source-path links | “Read the privacy policy” and “Read the terms”, pointing to deployed `/privacy/` and `/terms/`. |

## Verification record

| Check | Result | Evidence |
| --- | --- | --- |
| Live cold first screen, 390 px and desktop | Pass for basic comprehension | One h1; purpose and first actions visible before scroll. |
| One-click product view | Partial | Sample immediately indexed two messages and showed workspace, but it is not an isolated demo. |
| Demo banner/reset/start-real/direct URL | **Fail / blocking** | No banner or controls; `/demo` 404; `?demo=1` welcome; production-named IndexedDB. |
| Demo request isolation | Partial observation only | Sample run issued same-origin requests only; no sandbox storage isolation exists. |
| Offline | Partial observation only | After installation, fresh context offline reload showed the welcome h1. No claim registry maps this to a promise. |
| `npm test` | Pass | 13 tests passed. |
| `npm run build` | Pass | Produced `dist/`; main JS gzip reported 14.16 kB. |
| `npm run test:e2e` | Pass | 11 passed, 3 intentionally skipped; includes axe and offline shell check. |
| `npm run test:headers` | Pass | Completed successfully. |
| Every claims.json test | **Fail / blocking** | No `.factory/claims.json`; therefore no required test commands exist. |
| Live crawl | Pass for currently linked URLs | Home, Privacy, Terms, and Source returned 200; the planned `/demo` does not exist. |
| Metadata/structure | Fail | Details in M1; no canonical/OG/Twitter and generic 404. |
| Console on normal initial load/sample | Pass | No console errors captured. Deliberately visiting 404 routes produced expected failed-resource errors. |

## Acceptance condition

Re-review only after B1–B4 are fixed, all UC rows are either registered/tested or removed, and the copy/metadata fixes are applied. The verdict can pass only when there are zero blocking findings and at most three minor findings.
