# Adversarial first-read review 2 — Paper Trail

**Reviewed:** 2026-08-28 UTC  
**Target:** <https://mbox-takeout-viewer.sociobot.in>  
**Method:** fresh Chromium contexts at 390 × 844 and 1440 × 900; live route, storage, request, keyboard, metadata, and link checks; clean-install repository checks.

## Verdict: FAIL

There are four blocking findings. The first screen, visual identity, direct demo, core demo task, most earlier repairs, and the registered claim commands pass. However, the prior copy repair remains incomplete, the privacy proof never uses a locally supplied archive, opening a message fails to move focus to its new route heading, and the direct designed 404 omits the required shared skeleton and social/canonical metadata. The required standard is zero findings.

## Cold first read

Before scrolling, at both 390 px and desktop, I understood: this searches a Gmail Takeout archive in the browser for a person trying to find one email; I should click **Try it with sample data** before opening my own archive. The purpose, audience, and first action are all visible on the first screen. This check passes.

The mobile screen remains usable and legible at 390 px. The stamped-paper palette, ink outlines, type pairing, and original archive-indexer illustration are distinct from a generic SaaS template and match the documented design direction.

## Findings (highest severity first)

### BLOCKING F-2-1 (M2) — The prior unexplained “index backup” control remains on the first screen

**Location / quote:** Landing secondary action: **“Open an index backup”**.

**Evidence:** The live first screen presents this control alongside the real and sample entry points, but no nearby copy says what an index is, what file it opens, or when a first-time visitor would use it. `src/main.ts:106` has the same text. Review 1’s M2 copy-fix table explicitly required this rewrite **“(and add one sentence explaining it)”**. The rename happened; the explanation did not.

**Why this loses a first-time visitor:** “Index” is implementation vocabulary, not the job a Gmail Takeout visitor came to do. A visitor cannot predict whether opening it will restore mail, import a browser setting, or replace data.

**Concrete fix:** Rename the action to **“Restore a saved archive backup”** and add adjacent helper text: “Use a backup created by Paper Trail to restore its saved message list.” Keep it secondary to the sample and real-archive actions. Add a copy regression assertion for that helper text.

### BLOCKING F-2-2 (B2 / UC-03) — The privacy claim test does not prove the real-archive boundary it promises

**Location / quote:** Privacy page: **“Paper Trail reads archives you choose in this browser.”** Claim registry: **“Your archive stays in this browser.”**

**Evidence:** The listed `@claim:local-network` command passes, but its test (`tests/app.spec.ts:20–28`) only calls `openDemo()`, searches the built-in sample, opens a sample message, and asserts every request is same-origin. It never supplies an MBOX file through the real archive path, never observes that file’s name/content/query, and cannot establish that a visitor-selected archive remains local. Review 1’s UC-03 required the network test to use “a real locally supplied fixture as well as demo data”; that part was not implemented. Source inspection shows the ordinary file path is different from the demo path (`acceptFile` / `startIndex`), so sample-only coverage is not an equivalent proof.

**Why this loses or misleads a first-time visitor:** Privacy is the central decision for an email archive. A test of public sample data does not substantiate the statement about a person’s own archive.

**Concrete fix:** Add a clean-context Playwright claim test that supplies a uniquely named MBOX fixture through **Open your Takeout archive**, searches a unique fixture term, records all requests for the full index/search/read/export flow, and asserts that no request URL or body contains the fixture name, content, or query and that no cross-origin request occurs. Keep the existing demo request test separately if desired. Update the `local-network` sandbox description to name both flows.

### BLOCKING F-2-3 (B3) — Opening a message route leaves keyboard focus on the document body

**Location / quote:** Demo result **“Your first recovered message”** → `/demo/archive/.../message/0`.

**Evidence:** In a fresh live desktop context, clicking that result changed the URL and title to **“Message — Paper Trail”** and rendered the message h1, but after the message loaded `document.activeElement` was `BODY`. On browser Back, focus correctly reached the archive h1, so this is specifically the forward route transition. The cause is visible in `src/main.ts:225–251` and `513–527`: `navigate()` schedules `announceRoute()` while the loading reader has no h1; after `readRaw()` resolves, `render()` inserts the message h1 without another announcement or focus move. Review 1 B3 required route-change focus and a polite announcement for meaningful views; this route is only half repaired.

**Why this loses a first-time visitor:** A keyboard or screen-reader user activates a result and receives neither focus on the message title nor a route announcement. They are left at the old document position and must rediscover the new content.

**Concrete fix:** Give the loading reader an h1, or call `announceRoute()` after the parsed-message render. Add a live browser assertion that activating a result focuses `main h1`, and verify the polite route region contains the message subject.

### BLOCKING F-2-4 (M1) — The direct designed 404 does not use the required route skeleton or metadata

**Location / quote:** <https://mbox-takeout-viewer.sociobot.in/404>, **“This paper trail ends here.”**

**Evidence:** Direct `/404` returns the static `404.html`, with one h1 and a home link, but it has no shared header, skip link, primary navigation, footer, canonical link, Open Graph metadata, or Twitter metadata. The live document body is only `main`; its title and description exist but its route chrome differs from the rest of the product. `public/404.html` confirms the omissions. A non-existent SPA path is rendered by the app shell and does have the shell, but that does not repair the named designed-404 route. Review 1 M1 required the shared skeleton and metadata on every static page; this remains incomplete.

**Why this loses or misleads a first-time visitor:** A direct 404 reached from a shared link looks like a detached error document, with no Demo/Privacy path or product identity beyond a text link. Its social preview and canonical metadata are also incomplete.

**Concrete fix:** Build the static 404 with the same skip link, linked Paper Trail header, Demo/Privacy navigation, legal footer, canonical URL, OG title/description/image, and Twitter card as the other static routes. Keep the existing distinctive error artwork and home action. Add a route test for direct `/404` that asserts the skeleton and metadata.

## Copy audit

Word counts treat visible labels/headings as copy and link text as words; code blocks are excluded. No landing or README sentence exceeds 22 words. No banned marketing adjective appears. The sole copy finding is F-2-1 above.

### Landing page

| Words | Exact copy | Result |
| ---: | --- | --- |
| 2 | Paper Trail | product name |
| 1 | Demo | navigation label |
| 1 | Privacy | navigation label |
| 4 | Gmail Takeout archive viewer | clear context label |
| 5 | Search your Gmail Takeout archive | clear verb-first h1 |
| 7 | For people finding one needed email. | clear audience/situation |
| 9 | Read messages and export selected emails in this browser. | covered by reading/export claims |
| 6 | Choose an archive from your device. | clear fact |
| 6 | Search messages, sender, dates, and attachments. | covered by `archive-search` |
| 8 | Try the sample inbox before opening your own. | clear next step |
| 5 | Open your Takeout archive | clear result-naming action |
| 6 | Try it with sample data | clear required demo action |
| 4 | Open an index backup | **F-2-1: unexplained jargon** |
| 10 | The sample opens an inbox you can search and export. | clear result explanation |
| 3 | Your archive desk | decorative but understandable label |
| 6 | How you search a Takeout archive | out-of-context heading works |
| 3 | Choose the archive | step label |
| 7 | Open the email archive from your device. | clear instruction |
| 3 | Find a message | step label |
| 6 | Search words, sender, date, or attachments. | clear instruction |
| 4 | Export what you need | step label |
| 6 | Download an attachment or selected emails. | covered by attachment/export claims |
| 7 | Search Gmail Takeout archives in your browser. | concise product line |
| 1 | Terms | legal navigation label |
| 2 | Source (GitHub) | explicit external destination |

### README

| Words | Exact copy | Result |
| ---: | --- | --- |
| 2 | Paper Trail | heading/product name |
| 8 | Search a Gmail Takeout archive in your browser. | clear task statement |
| 8 | Read messages, download attachments, and export selected emails. | covered by claims |
| 8 | Try the sample inbox at Paper Trail demo. | clear demo link instruction |
| 7 | Demo data is separate from real archives. | covered by demo-isolation claim |
| 4 | Reset it any time. | covered by demo reset behaviour |
| 2 | Run locally | clear heading |
| 9 | Open `/demo` to search and export the sample inbox. | clear direct demo instruction |
| 9 | Use **Start for real** before opening your own archive. | clear safety instruction |
| 3 | Verify and build | clear heading |
| 8 | Every visitor-facing product claim is listed in `.factory/claims.json`. | repository verification instruction |
| 8 | Run each listed command from a clean checkout. | repository verification instruction |
| 8 | Deploy the generated `dist/` directory as a static site. | deployment instruction |
| 3 | Privacy and support | clear heading |
| 8 | Paper Trail has a separate demo storage area. | covered by demo-isolation claim |
| 8 | Read the privacy policy and terms. | clear linked legal instruction |
| 2 | MIT licensed. | licence fact |
| 2 | See LICENSE. | licence link |

## Demo and sandbox check

**Pass.** A fresh `/demo` context redirected to the populated archive workspace in one action. The first product screen showed three realistic messages, search/filter controls, attachment and selected-email export actions, and the persistent **“Demo — sample data, nothing is saved”** banner with **Reset demo** and **Start for real**. Fresh `/demo` and `/?demo=1` contexts created only `demo:paper-trail-index`; no production `paper-trail-index` was present. Reset recreated the sample; Start for real removed the demo database. Live demo requests were same-origin only and no console/page errors occurred.

The demo path, sample contents, reset behaviour, and database namespace are documented in `.factory/demo.md`.

## Claims and clean-clone checks

`npm ci`, `npm test` (13 tests), `npm run build`, and `npm run test:headers` passed. The build produced `dist/`; entry JavaScript gzip was 14.98 kB.

All eight listed claim commands passed when run individually on desktop Chromium:

| Claim | Result |
| --- | --- |
| `demo-isolation` | pass |
| `local-network` | pass, but inadequate for F-2-2 |
| `no-tracking` | pass |
| `message-reading` | pass |
| `archive-search` | pass |
| `email-export` | pass |
| `attachment-download` | pass |
| `offline-reload` | pass |

The complete browser suite passed: 21 passed, 1 intentional mobile skip. The offline claim was independently exercised by loading `/demo`, waiting for service-worker control, setting the fresh context offline, and navigating to `/demo` again.

## Earlier findings recheck

Read: `.factory/review-1.md`, `.factory/handoff.md`, and all `.factory/verification*.md`; no `.factory/polish-*.md` exists.

| Earlier ID | Live/code result |
| --- | --- |
| B1 | Fixed: direct isolated demo, banner, reset/start-real, sample workspace, and namespace are verified. |
| B2 | **Partially fixed — recurs as F-2-2.** Registry and tagged tests exist, but the former UC-03 real-archive privacy proof is still absent. |
| B3 | **Partially fixed — recurs as F-2-3.** URLs, Back, 404 rendering, and archive-heading focus work; forward message-route focus/announcement does not. |
| B4 | Fixed: `.factory/demo.md` documents the direct demo and storage contract. |
| M1 | **Partially fixed — recurs as F-2-4.** Root/legal metadata and shared chrome are present; direct `/404` is incomplete. |
| M2 | **Partially fixed — recurs as F-2-1.** The main copy is now plain; the backup action remains unexplained. |
| UC-01, UC-02, UC-04–UC-32 | Prior quoted claims were removed or replaced with registered, exercised task claims; no recurrence found in live landing/README copy. |
| UC-03 | **Recurs via F-2-2.** The reworded local-archive claim lacks the required real-fixture network proof. |

## Structure, links, accessibility, and missed leverage

- Live `/`, `/demo`, `/privacy/`, `/terms/`, `/404`, manifest, robots, sitemap, social image, and the explicit GitHub source link returned 200; `mailto:` links are explicit. No crawl dead link was found.
- Root, demo/archive/message, privacy, and terms have an appropriate title, one h1, description, canonical, favicon, OG/Twitter metadata, and main landmark. Direct `/404` is the exception in F-2-4.
- The live normal and demo flows showed no console errors. Existing Playwright axe coverage passed for serious/critical issues; visible focus and 390 px layout were verified in the fresh run.
- No AI feature is expected by the actual archive viewer job and none is needed to complete search/read/export. There is no decorative AI control or embedded provider key. Import/backup and export paths already cover the obvious non-AI leverage.

## What would make this perfect

Explain the backup action in user language, prove the local-data promise with an actual supplied archive, complete focus/announcement on the message route, and make the direct 404 a full product route. Then rerun every listed claim command and the full browser suite from a clean checkout. With those changes, the direct demo, strong first screen, PWA flow, and distinct visual system would support a PASS.
