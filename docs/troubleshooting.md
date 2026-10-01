---
title: Troubleshooting
---

## No warnings or completions for other pages

Warnings about unknown references, and completion of labels in other pages, come from mystmd's content server.
The language server starts it for you with `myst start --headless`, and it builds your whole project, so the server knows every page, label and citation.
Most gaps come from the content server not running.
Check that:

- the workspace folder you opened has a `myst.yml` in it or above it, and a git repository's root didn't stop the search, since the server doesn't look above it (see [](configuration.md#finding-the-project)),
- `myst` is installed, and `myst start --headless` works in that folder,
- you didn't pass `--no-myst`, which stops the server from starting mystmd,
- the project has finished loading.

Some clients may not show the "Loading project" progress, so a project can still be loading when it looks idle.
See [](how-it-works.md) for why the server works this way.

## No citation warnings

Unknown citation keys are only reported when every bibliography file is local.
Projects without a `.bib` file get no citation warnings.
See [](features.md#citations).
