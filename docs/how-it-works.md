---
title: How it works
---

This page explains where the server gets its information, for people who want to know why it behaves as it does.

## Two sources of truth

The server combines two views of your project:

- **The content server.** In a project with a `myst.yml`, the server starts `myst start --headless`, which builds every page and serves a content server.
  Hosts that already run mystmd, like MyST Author, pass its address with `--content-server` instead.
  The server indexes the result, so it knows every page, label and citation.
  It reloads the index when the content server reports a change.
  Project-wide features need this, such as warnings for unknown targets and find references across files.
- **Open documents.** These are re-parsed live with mystmd's parser, so unsaved labels are available immediately.

Without a content server, only open documents are indexed, and unknown targets aren't reported.
That happens when there's no `myst.yml`, when mystmd isn't installed, or when you pass `--no-myst`.
See [](configuration.md) for the flags.

## What a replacement parser needs to provide

Open documents are parsed twice: by mystmd's parser (`src/mystmd/parse.ts`) for targets and warnings, and by regexes (`src/syntax.ts`) for the position of each reference.
A parser such as [myst-parser-unified](https://github.com/choldgraf/myst-parser-unified) could replace the reference regexes if it provides:

- Pre-transform myst-spec mdast, so myst-transforms still run on it.
  mystmd uses `unified@10` and `vfile@5`, so a parser on `vfile@6` needs care at that boundary.
- Positions for the parts inside nodes: the target in `` {ref}`text <target>` ``, the label in `(x)=`, and directive arguments and options.
- Tolerance of half-typed input, since most documents are mid-edit.
- Speed enough to parse every page in the project for find references.

The swap point is `refsInText` and `labelDefinition` in `src/syntax.ts`, not `parse.ts`.
`refAt` and `optionAt`, which read the cursor's context in half-typed text, stay regex-based.
