---
title: How it works
---

This page explains where the server gets its information, for people who want to know why it behaves as it does.

## Two sources of truth

The server combines two views of your project:

- **The content server.** In a project with a `myst.yml`, the server starts `myst start`, which builds every page and serves the site and a content server.
  The server indexes the result, so it knows every page, label and citation.
  It reloads the index when the content server reports a change.
  Project-wide features need this, such as warnings for unknown targets and find references across files.
- **Open documents.** These are re-parsed live with mystmd's parser, so unsaved labels are available immediately.

Without a content server, only open documents are indexed, and unknown targets aren't reported.
That happens when there's no `myst.yml`, when mystmd isn't installed, or when you pass `--no-myst`.
See [](configuration.md) for the flags.
