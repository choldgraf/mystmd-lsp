---
title: Contributing
---

## Layout

- `packages/server`: the `mystmd-lsp` npm package. `npm run build` bundles `src` into `dist/server.cjs`.
  It also copies the root README and LICENSE into `packages/server` for the npm page, so edit the root README, not that copy.
- `packages/vscode`: the VS Code extension, which copies that bundle in at build time.
  For extensions that build on it, `activate()` returns `{ client, server }`.
  `client` is the language client, and `server` is the path of the server script.
  MyST Author uses the client to [ask where the project is](configuration.md#asking-where-the-project-is).
  It also runs the script again with `--root` and `--content-server` for its own editors.
- `demo`: a MyST project that walks through each feature.
- `docs`: this site.
- `.devcontainer` and `binder`: the Codespaces and Binder configs, which open the demo with the extension and with jupyterlab-lsp.

The root `package.json` is private, and its scripts call the packages' scripts, so the commands below work from the repository root.
Paths like `src/service.ts` in these docs are inside `packages/server`.

[MyST Author](https://chrisholdgraf.com/myst-author/) is one client of this server.
See [how the repositories fit together](https://chrisholdgraf.com/myst-author/develop/repositories) for what lives where.

## Set up

You need Node 22.18 or newer, since the tests run the TypeScript source directly.
From the repository root:

```sh
npm ci
npm test # builds first
npm run test:mystmd # also runs the tests that start mystmd
npm run typecheck
npm run conformance # compares the reference regexes with mystmd (see Conformance below)
```

`npm test` skips the tests that start mystmd, so it passes without a working mystmd.
`npm run test:mystmd` runs them, and fails if mystmd doesn't start.
CI is defined in `.github/workflows/test.yml`.

## Try your build

Run `npm run demo:copy`, then open `/tmp/mystmd-lsp-demo` in an editor set up as in [](editors.md).
Use `node <absolute path to packages/server/dist/server.cjs> --stdio` as the server command, instead of `mystmd-lsp --stdio`.
The demo walks through each feature.
It works on a copy, so `demo/` isn't edited.
In VS Code, point the MyST Language Server extension's `mystmdLsp.serverPath` setting at your `packages/server/dist/server.cjs`.

## Code map

- `src/syntax.ts`: finds reference syntax in text.
- `src/index-targets.ts`: collects reference targets from an mdast tree.
- `src/project.ts`: the project index, from the content server's pages and the open documents.
- `src/root.ts`: finds a document's project, looking no higher than its workspace folder.
  It also reads the project's `myst.yml`, lists its files and splits notebooks into Markdown cells.
- `src/xref.ts`: external project inventories and `xref:` resolution.
- `src/cite.ts`: reads the project's `.bib` files.
- `src/kinds.ts`: the completion icon for each kind of target.
- `src/plugins.ts`: directive and role specs from the JavaScript plugins in `myst.yml`.
- `src/service.ts`: the features (completion, hover, diagnostics, ...) without an LSP connection, so tests can call them directly.
- `src/server.ts`: connects the features in `service.ts` to LSP requests.
- `mystmd-client`, a separate package, has three exports:
  - `parse`: the mystmd parser with its default extensions.
  - `content-server`: a client for the content server.
  - `start`: a launcher for `myst start`.

Tests sit next to the code they cover, as `*.test.ts`.
To add a feature, such as a new diagnostic:

1. Put the logic in `src/service.ts`, and add a test to `service.test.ts` beside it.
   To run one file, use `node --test src/service.test.ts` in `packages/server`.
2. Connect it to its LSP request in `server.ts`.
3. Document it in [](features.md), and add a line to the README's "What you get" only if it's a new kind of feature.

## Conformance

References come from regexes.
[](design.md#replacing-the-reference-regexes) says why, and what a parser would need to replace them.

`npm run conformance` checks that the regexes find the same references and label definitions as mystmd's parser, on the [myst-spec](https://github.com/jupyter-book/myst-spec) examples.
It fails when it finds a difference that isn't listed in `known`, at the top of `scripts/conformance.ts`.
It also fails when a difference listed in `known` is gone.

To also run it on your own projects, point `MYST_CORPUS` at a folder:

```sh
MYST_CORPUS=path/to/projects npm run conformance
```

This reads every `.md` file and the Markdown cells of every `.ipynb` file, skipping hidden files, `node_modules` and `_build`.
Corpus differences are reported but don't fail the run.

## Kept in sync by hand

Change these together:

- The `mystmd` version here and the `myst-parser` version that this repo's `package-lock.json` resolves for mystmd-client.
- What the VS Code extension's `activate` returns, under Layout, and what MyST Author's extension reads from it.

## Docs

The docs are a MyST site in `docs/`.
Each fact has one home, so change it there rather than repeating it:

- [](features.md) and [](configuration.md) are the reference.
- [](editors.md) has the setup for each kind of client, so add new clients there.
- The README only has what a visitor to the repository needs, and the home page of this site includes it.

Run `npm run docs:live` to preview the site, and `npm run docs` to build it.
The site deploys to GitHub Pages when `main` changes.

## Record the demo video

The demo video at the top of the README and the docs is an attachment on [issue #2](https://github.com/choldgraf/mystmd-lsp/issues/2), not a file in git.
mystmd can't show a remote video in a figure yet ([mystmd#3100](https://github.com/jupyter-book/mystmd/issues/3100)).
So `npm run docs` and `npm run docs:live` first run `npm run docs:videos`, which downloads it into `docs/videos/`.
It skips the download when the video is already there, so delete `docs/videos/vscode.mp4` to download the attached one again.
The video's URL is in `docs/videos/download.mjs`.

Record the video again when a feature in it looks different.
It's recorded with [shot-scraper](https://shot-scraper.datasette.io/en/stable/video.html), from the storyboard in `docs/videos/vscode.yml`.
Run it from the repository root:

```sh
uvx shot-scraper video docs/videos/vscode.yml --mp4 --timeout 120000
```

It uses port 9300 and records on a copy of the demo in `/tmp/mystmd-lsp-video`.
If a recording stops partway, code-server may keep running, so stop it with `pkill -f /tmp/mystmd-lsp-code-server` before you try again.
It writes `vscode.webm` and `vscode.mp4` into `docs/videos/`.
The docs build shows the new MP4 right away, because `npm run docs:videos` doesn't replace it.
To publish it, drag the MP4 into a comment on the issue above.
Then replace the old URL with the new attachment's URL in `docs/videos/download.mjs` and the README.

## Releasing

Each package is released on its own, with its own version.
The extension bundles the server from the working tree, so a server change usually means releasing both.

1. Run `npm version <version> --no-git-tag-version -w packages/<name>`.
2. Commit the changes to that `package.json` and `package-lock.json`.
   Push to main.
3. Run the Release workflow (`.github/workflows/release.yml`) from the Actions tab and pick the package, or run `gh workflow run release.yml -f package=<name>`.

It publishes the package at the version in its `package.json`.
Then it tags the commit and creates a GitHub release with generated notes.
The tag is `mystmd-lsp-v<version>` for the server, or `vscode-v<version>` for the extension.
Edit the release afterwards to replace the notes with ones from [github-activity](https://github-activity.readthedocs.io/).
Publishing the server needs npm's [trusted publisher](https://docs.npmjs.com/trusted-publishers) set up for `release.yml`.
Publishing the extension needs the `VSCE_PAT` and `OVSX_PAT` secrets of the `myst-author` publisher, on the Marketplace and on Open VSX.
MyST Author picks up new releases through [its dependencies](https://chrisholdgraf.com/myst-author/develop/repositories).
