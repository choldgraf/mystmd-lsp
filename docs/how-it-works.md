---
title: How it works
---

## Two sources of truth

- **The content server.** In a project with a `myst.yml`, the server starts `myst start --headless`, which builds every page and serves a content server.
  Clients that already run mystmd pass its address with `--content-server` instead, as [MyST Author does](https://chrisholdgraf.com/myst-author/develop/repositories).
  The server indexes the result, so it knows every page, label and citation.
  It reloads the index when the content server reports a change.
  Warnings for unknown targets and completion of labels from other pages need this.
- **Open documents.** These are re-parsed live with mystmd's parser, so unsaved labels are available immediately.

Without a content server, only open documents are indexed, and unknown targets aren't reported.
That happens when there's no `myst.yml`, when mystmd isn't installed or fails to start, or when you pass `--no-myst`.
See [](configuration.md) for the flags.

See [](design.md) for why it works this way, and what we measured.
