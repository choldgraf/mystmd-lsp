---
title: Contributing
---

## Layout

- `src`: the server, which `npm run build` bundles into `dist/server.cjs` for npm.
- `demo`: a MyST project that walks through each feature.
- `docs`: this site.

[MyST Author](https://chrisholdgraf.com/myst-author/) is one client of this server.
See [how the repositories fit together](https://chrisholdgraf.com/myst-author/develop/repositories) for what lives where.

## Set up

You need Node 22.18 or newer, since the tests run the TypeScript source directly.
The bundled server runs on Node 22.
From the repository root:

```sh
npm ci
npm test # builds first
npm run test:mystmd # also runs the tests that start mystmd
npm run typecheck
npm run conformance # compares the reference regexes with mystmd; see Conformance below
```

CI runs the same commands.
`npm test` skips the tests that start mystmd, so it passes without a working mystmd.
`npm run test:mystmd` runs them, and fails if mystmd doesn't start.

## Try your build

Run `npm run demo:copy`, then open `/tmp/mystmd-lsp-demo` in an editor set up to run your `dist/server.cjs` (see [](editors.md)).
The demo walks through each feature, and works on a copy so `demo/` isn't edited.
In VS Code, MyST Author's extension can run your build; see its [VS Code page](https://chrisholdgraf.com/myst-author/guide/vscode).

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
- `src/mystmd/`: the mystmd parser with its default extensions (`parse.ts`), a client for the content server (`content-server.ts`), and a launcher for `myst start` (`start.ts`).

Tests sit next to the code they cover, as `*.test.ts`.
To add a feature, such as a new diagnostic:

1. Put the logic in `src/service.ts`, and add a test to `service.test.ts` beside it.
   To run one file, use `node --test src/service.test.ts`.
2. Wire it up in `server.ts`.
3. Document it in [](features.md), and add a line to the README's "What you get" only if it's a new kind of feature.

## Replacing the reference regexes

Open documents are parsed twice.
mystmd's parser (`src/mystmd/parse.ts`) finds targets and warnings.
Regexes (`src/syntax.ts`) find the position of each reference.
A parser such as [myst-parser-unified](https://chrisholdgraf.com/myst-parser-unified/) could replace the reference regexes if it provides:

- Pre-transform myst-spec mdast, so myst-transforms still run on it.
  mystmd's transforms use older majors of unified and vfile, so the parser's trees must still work with them.
- Positions for the parts inside nodes, such as the target in `` {ref}`text <target>` ``, the label in `(x)=`, and directive arguments and options.
- Tolerance of half-typed input, since most documents are mid-edit.
- Speed enough to parse every page in the project for find references.

The swap point is `refsInText` and `labelDefinition` in `src/syntax.ts`, not `parse.ts`.
`refAt` and `optionAt` read the cursor's context in half-typed text, so they stay regex-based.

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

## Docs

The docs are a MyST site in `docs/`.
Each fact has one home, so change it there rather than repeating it:

- [](features.md) and [](configuration.md) are the reference.
- [](editors.md) has the setup for each kind of client; add new clients there.
- The README only has what a visitor to the repository needs, and the home page of this site includes it.

Run `npm run docs:live` to preview the site, and `npm run docs` to build it.
The site deploys to GitHub Pages when `main` changes.

## Releasing

1. Run `npm version <version> --no-git-tag-version`.
2. Commit the changes to `package.json` and `package-lock.json`. Push to main.
3. Run the Release workflow (`.github/workflows/release.yml`) from the Actions tab, or with `gh workflow run release.yml`.

It publishes the package at the version in `package.json`, then tags the commit `mystmd-lsp-v<version>` and creates a GitHub release with generated notes.
Edit the release afterwards to replace the notes with ones from `github-activity`.
Publishing needs npm's [trusted publisher](https://docs.npmjs.com/trusted-publishers) set up for `release.yml`.
MyST Author picks up a new release when its `mystmd-lsp` dependency is bumped.
