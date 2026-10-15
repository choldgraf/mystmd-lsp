---
title: Contributing
---

## Layout

- `packages/server`: the `mystmd-lsp` npm package. `npm run build` bundles `src` into `dist/server.cjs`.
- `packages/vscode`: the VS Code extension, which copies that bundle in at build time; see its [README](https://github.com/choldgraf/mystmd-lsp/tree/main/packages/vscode).
- `demo`: a MyST project that walks through each feature.
- `docs`: this site.
- `.devcontainer` and `binder`: the Codespaces and Binder configs, which open the demo with the extension and with jupyterlab-lsp.

The root `package.json` is private and runs each command in every package, so the commands below work from the repository root.
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
npm run conformance # compares the reference regexes with mystmd; see Conformance below
```

`npm test` skips the tests that start mystmd, so it passes without a working mystmd.
`npm run test:mystmd` runs them, and fails if mystmd doesn't start.
CI runs `test:mystmd`, `typecheck` and `conformance`, and packages the VS Code extension.

## Try your build

Run `npm run demo:copy`, then open `/tmp/mystmd-lsp-demo` in an editor whose LSP command is `node packages/server/dist/server.cjs --stdio` instead of `mystmd-lsp --stdio` (see [](editors.md)).
The demo walks through each feature, and works on a copy so `demo/` isn't edited.
In VS Code, point the MyST Language Server extension's `mystmdLsp.serverPath` setting at your `packages/server/dist/server.cjs`.

## Code map

- `src/syntax.ts`: finds reference syntax in text.
- `src/index-targets.ts`: collects reference targets from an mdast tree.
- `src/project.ts`: the project index, from the content server's pages and the open documents.
- `src/root.ts`: finds the project folder and reads its `myst.yml`.
- `src/xref.ts`: external project inventories and `xref:` resolution.
- `src/cite.ts`: reads the project's `.bib` files.
- `src/kinds.ts`: the completion icon for each kind of target.
- `src/service.ts`: the features (completion, hover, diagnostics, ...) without an LSP connection, so tests can call them directly.
- `src/server.ts`: the LSP wiring.
- `mystmd-client`, a separate package: the mystmd parser with its default extensions (`parse`), a client for the content server (`content-server`), and a launcher for `myst start` (`start`).

Tests sit next to the code they cover, as `*.test.ts`.
To add a feature, such as a new diagnostic:

1. Put the logic in `src/service.ts`, and add a test to `service.test.ts` beside it.
   To run one file, use `node --test src/service.test.ts` in `packages/server`.
2. Wire it up in `server.ts`.
3. Document it in [](features.md), and add a line to the README's "What you get" only if it's a new kind of feature.

## Replacing the reference regexes

See [](design.md#replacing-the-reference-regexes) for why references come from regexes and what a parser would need to replace them.

### Conformance

`npm run conformance` checks that the regexes find the same references and label definitions as mystmd's parser.
It compares the targets of label roles (`{ref}`, `{eq}`, `{numref}`), `{doc}` roles, `[](path)` links, `[](#label)` links, and label definitions (`(x)=`, `:label:` and `:name:` options, and `$$ (id)`).
It runs on the [myst-spec](https://github.com/jupyter-book/myst-spec) examples of roles, directives and references, prints each difference, and prints a table of matched, missed and false positive targets for each kind.
It fails if an example differs that isn't in the list of known differences at the top of `scripts/conformance.ts`, or if one in the list no longer differs.
myst-spec has no `{doc}` role or `[](#label)` examples, so CI's check doesn't cover those kinds; only a corpus run by hand does.

To also run it on your own projects, point `MYST_CORPUS` at a folder:

```sh
MYST_CORPUS=path/to/projects npm run conformance
```

This reads every `.md` file and the Markdown cells of every `.ipynb` file, skipping hidden files, `node_modules` and `_build`.
It only reports; differences in the corpus don't fail the run.
mystmd leaves the body of a directive it doesn't know, like `{myst}` in mystmd's docs, as text, so the regexes find references there that mystmd doesn't.

## Kept in sync by hand

Change these together:

- `.github/workflows/test.yml` and the commands under Set up.
- The label roles `['ref', 'eq', 'numref']` in `scripts/conformance.ts` and the role alternation in `src/syntax.ts`.
- The `kinds` in `scripts/conformance.ts`, the prefixes that its `mystmd` and `regexes` functions emit, the kinds listed under Conformance, and the tables in [](design.md#conformance).
- The `known` entries in `scripts/conformance.ts` and the myst-spec example titles they name.
- `labelChars` in `src/syntax.ts` and mystmd's `TARGET_PATTERN` in markdown-it-myst's `dist/block.js`.
- The links a file move rewrites, listed in [](features.md#find-references-and-rename), and `isFile` in `src/service.ts`.
- The jupyterlab-lsp entry in [](editors.md) and in `binder/jupyter_server_config.py`.
- The VS Code document selector in [](editors.md) and in `packages/vscode/src/extension.ts`.
- What the VS Code extension's `activate` returns, described in [](configuration.md#asking-where-the-project-is), and what MyST Author's extension reads from it.
- The `mystmd` version here and the `myst-parser` version that mystmd-client pins; see mystmd-client's README.

## Docs

The docs are a MyST site in `docs/`.
Each fact has one home, so change it there rather than repeating it:

- [](features.md) and [](configuration.md) are the reference.
- [](editors.md) has the setup for each kind of client; add new clients there.
- The README only has what a visitor to the repository needs, and the home page of this site includes it.

Run `npm run docs:live` to preview the site, and `npm run docs` to build it.
The site deploys to GitHub Pages when `main` changes.

## Releasing

Each package is released on its own, with its own version.
The extension bundles the server from the working tree, so a server change usually means releasing both.

1. Run `npm version <version> --no-git-tag-version -w packages/<name>`.
2. Commit the changes to that `package.json` and `package-lock.json`.
   Push to main.
3. Run the Release workflow (`.github/workflows/release.yml`) from the Actions tab and pick the package, or run `gh workflow run release.yml -f package=<name>`.

It publishes the package at the version in its `package.json`, then tags the commit (`mystmd-lsp-v<version>` for the server, `vscode-v<version>` for the extension) and creates a GitHub release with generated notes.
Edit the release afterwards to replace the notes with ones from `github-activity`.
Publishing the server needs npm's [trusted publisher](https://docs.npmjs.com/trusted-publishers) set up for `release.yml`.
Publishing the extension needs `VSCE_PAT` and `OVSX_PAT` secrets for the `myst-author` publisher on the Marketplace and on Open VSX, which code-server uses.
MyST Author picks up new releases through its dependencies; see [how the repositories fit together](https://chrisholdgraf.com/myst-author/develop/repositories).
