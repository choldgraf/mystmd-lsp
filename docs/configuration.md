---
title: Configuration
---

The server has a few command-line flags, and reads your project's `myst.yml`.

```sh
mystmd-lsp --stdio [--root=path/to/project] [--content-server=URL] [--no-myst] [--execute]
```

- `--root`: one project at this folder for every document, with or without a `myst.yml`, instead of finding each document's project (see [](#finding-the-project)).
- `--content-server`: use a `myst start --headless` content server that is already running for the `--root` project, instead of starting one.
- `--no-myst`: don't start mystmd.
- `--execute`: when the server starts mystmd, run code cells and inline `{eval}` expressions too (`myst start --execute`). This runs the project's code, and needs Jupyter.

## Asking where the project is

Clients that build on this server can send the request `myst/project` once the server is initialized.
Its params are `{ uri?: string }` and it answers `{ root?: string; contentServer?: string; page?: boolean }`.
With `uri`, that's the document's project folder (see below), mystmd's URL if the server runs one, and whether mystmd builds the document; a document with no project gets `{}`.
Without `uri`, it's the `--root` project's `{ root, contentServer }`, else `{}`.
MyST Author's VS Code extension asks it for each document, to point its preview at the same mystmd.
In VS Code, the MyST Language Server extension's `activate()` returns `{ client, server }`: its language client and the path of the server script it runs.
MyST Author spawns that script again with `--root` and `--content-server` for its own editors.
The request's and the result's fields are stable; new ones are added beside them.

## Starting mystmd

See [](how-it-works.md) for when the server starts mystmd.
Like any `myst start`, that runs the project's plugins, which can run any code, and writes `_build/`.
If your editor has no workspace trust, start the server with `--no-myst` for folders you do not trust.
`myst start` listens on `localhost`, which can resolve to IPv6 only.
To pass an `http://127.0.0.1:<port>` address, start it with `HOST=127.0.0.1 myst start --headless`.
To run a `myst` that isn't on your `PATH`, set the `MYST_BIN` environment variable to its path.

## Finding the project

A document's project is the nearest `myst.yml` at or above the document's folder, no higher than the workspace folder that contains it.
So nothing above the folder you opened is picked up, and a folder holding several projects works: each project starts its own mystmd and index when the first document in it opens.
A document outside every workspace folder, or with no `myst.yml` between it and its workspace folder, has no project and gets no features.

A document gets features only if it's a page of its project, one that mystmd builds.
That makes `project.toc`, `project.exclude`, `_build`, hidden folders and nested projects mystmd's decision, so the editor agrees with the build.
Until the first build is indexed, or without mystmd (`--no-myst`, or mystmd missing or failed), any Markdown file or notebook under the project folder counts.

`--root` replaces all of this with one project at that folder, with or without a `myst.yml`.
A `myst.yml` created after the server started, or a workspace folder added later, isn't picked up until the server restarts (in VS Code, reload the window).

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
