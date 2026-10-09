---
title: How it works
---

The server combines two views of your project, which explains most of how it behaves.

## Two sources of truth

- **The content server.** In a project with a `myst.yml`, the server starts `myst start --headless`, which builds every page and serves a content server.
  Clients that already run mystmd pass its address with `--content-server` instead, as [MyST Author does](https://chrisholdgraf.com/myst-author/develop/repositories).
  The server indexes the result, so it knows every page, label and citation.
  It reloads the index when the content server reports a change.
  Project-wide features need this, such as warnings for unknown targets and find references across files.
- **Open documents.** These are re-parsed live with mystmd's parser, so unsaved labels are available immediately.

Without a content server, only open documents are indexed, and unknown targets aren't reported.
That happens when there's no `myst.yml`, when mystmd isn't installed or fails to start, or when you pass `--no-myst`.
See [](configuration.md) for the flags.
