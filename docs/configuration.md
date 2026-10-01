---
title: Configuration
---

The server has a few command-line flags, and reads your project's `myst.yml`.

```sh
mystmd-lsp --stdio [--root=path/to/project] [--content-server=http://127.0.0.1:3100] [--no-myst]
```

- `--root`: the project folder, instead of searching for it.
- `--content-server`: use a `myst start --headless` content server that is already running, instead of starting one.
  The server indexes every built page and reloads when the content server sends `RELOAD`.
- `--no-myst`: don't start mystmd.
  Only open documents are indexed, and unknown targets aren't reported.

## Finding the project

The project is the nearest `myst.yml` at or above the workspace folder.
The search stops at a git repository's root and at your home folder, so a `myst.yml` far above an unrelated folder isn't picked up.
Without a `myst.yml`, or if mystmd isn't installed or fails to start, the server only knows the open documents, and says so.

## What it reads from `myst.yml`

The project folder is used to list files for path completion, and to read `myst.yml` for the bibliography and external references.
Both are re-read when `myst.yml` or a `.bib` file changes, in clients that support file watching.

- `project.bibliography`: the `.bib` files for citations. Without it, every `.bib` file in the project is used, as in mystmd.
- `project.references`: the keys for [external references](features.md#external-references).

## Semantic token colours

References are semantic tokens, so you can colour them by kind.
The kinds are `semanticTokensLegend` in `packages/mystmd-lsp/src/service.ts`.
To colour references to figures in VS Code, set `"editor.semanticTokenColorCustomizations": { "rules": { "label.figure": "#2a9d8f" } }`.
