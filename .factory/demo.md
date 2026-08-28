# Paper Trail demo

Open [`/demo`](https://mbox-takeout-viewer.sociobot.in/demo) or `?demo=1` for the one-click sample inbox.

The sample archive has three messages: a recovered email, an HTML receipt with `receipt-note.txt`, and a project handoff. You can search, filter, open messages, download the attachment, and export a selected email.

Demo mode uses only IndexedDB database `demo:paper-trail-index`. It does not read or write `paper-trail-index`, the database used for real archives. The banner remains visible in every demo view. **Reset demo** deletes and recreates only the demo database. **Start for real** deletes the demo database and returns to the real archive welcome screen.
