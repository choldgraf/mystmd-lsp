---
title: Troubleshooting
---

## No warnings or completions for other pages

These come from mystmd's content server, so most gaps mean it isn't running or hasn't finished building.
Check that:

- the workspace folder you opened has a `myst.yml` in it or above it,
- if that folder is in a git repository, the `myst.yml` is in the same repository, since the search stops at its root (see [](configuration.md#finding-the-project)),
- `myst` is installed, and `myst start` works in that folder,
- you didn't pass `--no-myst`,
- the project has finished loading.

Some clients may not show the {gui}`Loading project` progress, so a project can still be loading when it looks idle.
See [](how-it-works.md) for why the server works this way.

## No citation warnings

Unknown citation keys are only reported when every bibliography file is local; see [](features.md#citations).
