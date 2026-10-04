---
title: Contributing
---

This page covers how to work on the server and the docs.

## Layout

- `src`: the server, which `npm run build` bundles into `dist/server.cjs` for npm.
- `demo`: a MyST project that walks through each feature.
- `docs`: this site.

The editor extensions for VS Code and JupyterLab live in [MyST Author](https://github.com/choldgraf/myst-author).

## Set up

You need Node 22 or newer.
From the repository root:

```sh
npm ci
npm test
npm run typecheck
npm run build
```

CI runs the same commands.

The server's `build` bundles it into `dist/server.cjs` with esbuild (`build.mjs`), which starts faster than the source.

To try your build in VS Code, install MyST Author's extension, set `mystAuthor.serverPath` to the full path of `dist/server.cjs`, and reload the window after each build.

## Code map

- `src/syntax.ts`: finds reference syntax in text.
- `src/index-targets.ts`: collects reference targets from an mdast tree.
- `src/project.ts`: the project index (content server pages plus open documents).
- `src/root.ts`: finds the project folder.
- `src/xref.ts`: external project inventories and `xref:` resolution.
- `src/cite.ts`: reads the project's `.bib` files.
- `src/service.ts`: the features (completion, hover, diagnostics, ...) without an LSP connection, so tests can call them directly.
- `src/server.ts`: the LSP wiring.
- `src/mystmd/`: mystmd's parser with its default extensions (`parse.ts`), a client for the `myst start` content server, and a launcher for `myst start`.

Tests sit next to the code they cover, as `*.test.ts`.
To add a feature, such as a new diagnostic:

1. Put the logic in `src/service.ts`, and add a test to `service.test.ts` beside it.
   To run one file, use `node --test src/service.test.ts`.
2. Wire it up in `server.ts`.
3. Document it in [](features.md), and add a line to the README's "What you get" only if it's a new kind of feature.

## Docs

The docs are a MyST site in `docs/`.
Each fact has one home, so change it there rather than repeating it:

- [](features.md) and [](configuration.md) are the reference.
- [](editors.md) has the setup for each kind of client; add new clients there.
- The README only has what a visitor to the repository needs, and the home page of this site includes it.

Run `npm run docs:live` to preview the site, and `npm run docs` to build it.
The site deploys to GitHub Pages when `main` changes.

## Releasing

The Release workflow (`.github/workflows/release.yml`) publishes the server to npm.
Run it from the Actions tab (Release → Run workflow) and type the version, or run:

```sh
gh workflow run release.yml -f version=0.1.0
```

It publishes the package at that version, then tags the commit `mystmd-lsp-v<version>` and creates a GitHub release with generated notes.
Edit the release afterwards to replace the notes with ones from `github-activity`.
The version in `package.json` isn't used for releases.
Publishing needs npm's [trusted publisher](https://docs.npmjs.com/trusted-publishers) set up for `release.yml`.
MyST Author picks up a new release through its dependency on `mystmd-lsp`.
