---
title: Configuration
---

The server has a few command-line flags, and reads your project's `myst.yml`.

```sh
mystmd-lsp --stdio [--root=path/to/project] [--content-server=URL] [--no-myst]
```

- `--root`: the project folder, instead of searching for it.
- `--content-server`: use a `myst start --headless` content server that is already running, instead of starting one.
- `--no-myst`: don't start mystmd.

## Starting mystmd

When the project has a `myst.yml`, the server runs `myst start --headless` in the project folder, unless you pass `--content-server` or `--no-myst`.
Like any `myst start`, that runs the project's plugins, which can run any code, and writes `_build/`.
If you already run `myst start --headless` for the project, pass the address it prints with `--content-server`, so the project isn't built twice.
`myst start` listens on `localhost`, which can resolve to IPv6 only.
To pass an `http://127.0.0.1:<port>` address, start it with `HOST=127.0.0.1 myst start --headless`.
To run a `myst` that isn't on your `PATH`, set the `MYST_BIN` environment variable to its path.
See [](how-it-works.md) for what the server uses mystmd for.

## Finding the project

The project is the nearest `myst.yml` at or above the workspace folder.
The search stops at a git repository's root, and doesn't look in your home folder or above it, so a `myst.yml` far above an unrelated folder isn't picked up.
Without a `myst.yml`, the server uses the workspace folder and only knows the open documents.
If mystmd isn't installed or fails to start, the server shows a warning and carries on with the open documents.

## What it reads from `myst.yml`

The server reads the bibliography and external references from `myst.yml`.
It re-reads them when `myst.yml` or a `.bib` file changes, if your editor supports file watching.

- `project.bibliography`: the `.bib` files for citations.
  Without it, every `.bib` file in the project is used, as in mystmd.
- `project.references`: the keys for [external references](features.md#external-references).

## Semantic token colours

References are semantic tokens, so you can colour them by kind.
The kinds are listed in `semanticTokensLegend` in `src/service.ts`.
To colour references to figures in VS Code, set `"editor.semanticTokenColorCustomizations": { "rules": { "label.figure": "#2a9d8f" } }`.
