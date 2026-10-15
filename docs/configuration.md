---
title: Configuration
---

The server has a few command-line flags, and reads your project's `myst.yml`.

```sh
mystmd-lsp --stdio [--root=path/to/project] [--content-server=URL] [--no-myst] [--execute]
```

- `--root`: the project folder, instead of searching for it.
- `--content-server`: use a `myst start --headless` content server that is already running, instead of starting one.
- `--no-myst`: don't start mystmd.
- `--execute`: when the server starts mystmd, run code cells and inline `{eval}` expressions too (`myst start --execute`). This runs the project's code, and needs Jupyter.

## Asking where the project is

Clients that build on this server can send the request `myst/project` once the server is initialized.
It answers `{ root?: string; contentServer?: string }`: the project folder the server chose (see below), and mystmd's URL if the server runs it.
MyST Author's VS Code extension uses it to point its preview at the same mystmd.

## Starting mystmd

See [](how-it-works.md) for when the server starts mystmd.
Like any `myst start`, that runs the project's plugins, which can run any code, and writes `_build/`.
If your editor has no workspace trust, start the server with `--no-myst` for folders you do not trust.
`myst start` listens on `localhost`, which can resolve to IPv6 only.
To pass an `http://127.0.0.1:<port>` address, start it with `HOST=127.0.0.1 myst start --headless`.
To run a `myst` that isn't on your `PATH`, set the `MYST_BIN` environment variable to its path.

## Finding the project

The project is the nearest `myst.yml` at or above the workspace folder.
The search stops at a git repository's root, and doesn't look in your home folder or above it, so a `myst.yml` far above an unrelated folder isn't picked up.
Without a `myst.yml`, the server uses the workspace folder and doesn't start mystmd; see [](how-it-works.md) for what that limits.

## What it reads from `myst.yml`

The server reads the bibliography and external references from `myst.yml`.
It re-reads them when `myst.yml` or a `.bib` file changes, if your editor supports file watching.

- `project.bibliography`: the `.bib` files for citations.
  Without it, every `.bib` file in the project is used, as in mystmd.
- `project.references`: the keys for [external references](features.md#external-references).

## Semantic token colours

References are semantic tokens, so you can colour them by kind.
The kinds are listed in `semanticTokensLegend` in [`src/service.ts`](https://github.com/choldgraf/mystmd-lsp/blob/main/packages/server/src/service.ts).
To colour references to figures in VS Code, set `"editor.semanticTokenColorCustomizations": { "rules": { "label.figure": "#2a9d8f" } }`.
