---
title: Contributing
---

This page covers how to work on the server, the editor clients and the docs.

## Layout

This repository holds the server and its editor clients, with one docs site for all of them:

- `packages/mystmd-lsp`: the server, published to npm.
- `packages/vscode`: the VS Code extension, with a grammar, commands and a copy of the server's bundle, released to the Marketplace and Open VSX by `release.yml`.
- `packages/jupyterlab`: `jupyter-mystmd-lsp`, a Python package that registers the server with jupyterlab-lsp, published to PyPI.
- `docs`: this site.

Each package has its own version.

## Set up

You need Node 22 or newer, and Python for `packages/jupyterlab`.
From the repository root:

```sh
npm ci
npm test
npm run typecheck
npm run build
```

These run in each package that defines them.
For `packages/jupyterlab`, run `pip install -e "packages/jupyterlab[test]"` and `pytest packages/jupyterlab`, and format with `black`.
CI runs the same commands.

The server's `build` bundles it into `dist/server.cjs` with esbuild (`packages/mystmd-lsp/build.mjs`), which starts faster than the source.
The extension's build runs the server's build and copies that bundle.

## Code map

- `packages/mystmd-lsp/src/syntax.ts`: finds reference syntax in text.
- `packages/mystmd-lsp/src/index-targets.ts`: collects reference targets from an mdast tree.
- `packages/mystmd-lsp/src/project.ts`: the project index (content server pages plus open documents).
- `packages/mystmd-lsp/src/root.ts`: finds the project folder.
- `packages/mystmd-lsp/src/xref.ts`: external project inventories and `xref:` resolution.
- `packages/mystmd-lsp/src/cite.ts`: reads the project's `.bib` files.
- `packages/mystmd-lsp/src/service.ts`: the features (completion, hover, diagnostics, ...) without an LSP connection, so tests can call them directly.
- `packages/mystmd-lsp/src/server.ts`: the LSP wiring.
- `packages/mystmd-lsp/src/mystmd/`: mystmd's parser with its default extensions (`parse.ts`), a client for the `myst start` content server, and a launcher for `myst start`.

Tests sit next to the code they cover, as `*.test.ts`.
To add a feature, such as a new diagnostic:

1. Put the logic in `packages/mystmd-lsp/src/service.ts`, and add a test to `service.test.ts` beside it.
   To run one file, use `node --test src/service.test.ts` in `packages/mystmd-lsp`.
2. Wire it up in `server.ts`.
3. Document it in [](features.md), and add a line to the README's "What you get" only if it's a new kind of feature.

## Docs

The docs are a MyST site in `docs/`.
Each fact has one home, so change it there rather than repeating it:

- [](features.md) and [](configuration.md) are the reference.
- [](editors.md) has one section per client; add new clients there.
- The README only has what a visitor to the repository needs, and the home page of this site includes it.

Run `npm run docs:live` to preview the site, and `npm run docs` to build it.
The site deploys to GitHub Pages when `main` changes.

## Releasing

Each package is released by pushing a tag named `<package>-v<version>`.
`.github/workflows/release.yml` publishes the package named by the tag.

| Package | Version lives in | Tag | Publishes to | Needs |
|---|---|---|---|---|
| `packages/mystmd-lsp` | `package.json` | `mystmd-lsp-v0.1.0` | npm | `NPM_TOKEN` |
| `packages/vscode` | `package.json` | `vscode-v0.1.0` | VS Code Marketplace, Open VSX | `VSCE_PAT`, `OVSX_PAT` |
| `packages/jupyterlab` | `pyproject.toml` | `jupyterlab-v0.1.0` | PyPI | trusted publisher, `pypi` environment |

Before tagging, bump the version in that file, and write the release notes with `github-activity`.
Versions are independent, so the extension and the server don't need to match.
