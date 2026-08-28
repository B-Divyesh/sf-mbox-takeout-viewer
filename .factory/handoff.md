# Review 2 handoff

## What was done

- Performed the requested independent, non-mutating adversarial review of the live site and repository.
- Wrote the complete report in `.factory/review-2.md`.
- Found four blocking issues: an unexplained backup action, incomplete real-archive privacy proof, missing focus after opening a message route, and incomplete direct-404 skeleton/metadata.

## Verification run

```text
npm ci                         passed
npm test                       passed (13 tests)
npm run build                  passed; dist/ produced
npm run test:headers           passed
8 registered claim commands    passed individually
npm run test:e2e               passed (21 passed, 1 intentional skip)
```

Live fresh-context checks covered 390 px and desktop landing comprehension, direct demo isolation/reset/start-real, same-origin demo requests, offline demo reload, message navigation/back/focus, metadata, links, and the direct 404.

## Left to address

See `review-2.md` findings F-2-1 through F-2-4. No product code was changed by this review.
