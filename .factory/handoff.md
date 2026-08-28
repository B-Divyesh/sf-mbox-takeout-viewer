# Review handoff — review 1

## Done

- Performed an adversarial first-read review of the deployed Paper Trail site at 390 px and desktop.
- Checked the landing/sample flow, browser storage, same-origin sample requests, offline reload, links, routes, metadata, 404 behaviour, README copy, and claim-test setup.
- Wrote the findings in `.factory/review-1.md` without modifying product code.

## Verification run

```bash
npm ci
npm test
npm run build
npm run test:e2e
npm run test:headers
```

All commands passed. The review verdict is **FAIL** because the required isolated direct demo, claims registry/tests, designed 404/deep routing, and demo documentation are absent.

## Known gaps for the product team

- No `.factory/claims.json` or `.factory/demo.md` exists.
- `/demo` returns a generic host 404; `?demo=1` does not start a demo.
- The sample writes to the production-named IndexedDB database and has no persistent demo banner/reset/start-real controls.
- The review lists complete landing/README copy counts and unlisted claims that need tests or removal.
