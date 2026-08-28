# Paper Trail

Search a Gmail Takeout archive in your browser. Read messages, download attachments, and export selected emails.

Try the sample inbox at [Paper Trail demo](https://mbox-takeout-viewer.sociobot.in/demo). Demo data is separate from real archives. Reset it any time.

## Run locally

```bash
npm ci
npm run dev
```

Open `/demo` to search and export the sample inbox. Use **Start for real** before opening your own archive.

## Verify and build

```bash
npm test
npm run build
npm run test:e2e
npm run test:headers
```

Every visitor-facing product claim is listed in `.factory/claims.json`. Run each listed command from a clean checkout.

Deploy the generated `dist/` directory as a static site.

## Privacy and support

Paper Trail has a separate demo storage area. Read the [privacy policy](https://mbox-takeout-viewer.sociobot.in/privacy/) and [terms](https://mbox-takeout-viewer.sociobot.in/terms/).

MIT licensed. See [LICENSE](LICENSE).
