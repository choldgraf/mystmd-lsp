---
title: What we learned
---

Why the server is built the way it is, what we measured, and what we need upstream.
See [](how-it-works.md) for the short version.

## A build and a live parse

The server reads a project two ways, because neither covers everything.

Closed files' targets, titles and enumerators (the `1` in `Figure 1`) come from the build: `myst start`, read page by page from the content server (`mystmd-client/content-server`).
We can't use `myst.xref.json` instead, because it isn't rewritten on edits and has no `title` or `enumerator`.

Open documents get a live parse: `mystParse` plus mystmd's per-page transforms, including `basicTransformationsPlugin` and `enumerateTargetsPlugin`, on that page alone (`mystmd-client/parse`).
So an open page's enumerators can differ from the build's when frontmatter sets `numbering`.

Directive transforms drop `position` on the nodes they make (see MyST Author's [data and packaging gaps](https://github.com/choldgraf/myst-author/blob/main/upstream/README.md#data-and-packaging-gaps-candidates-for-small-fixes)).
mystmd-client's `parseMyst` copies the directive's position onto its children, and `src/index-targets.ts` falls back to the first positioned descendant in built page JSON.

## References come from regexes

mystmd's parser finds targets and warnings, but regexes in `src/syntax.ts` find where each reference is.
The parse tree doesn't give us usable positions:

- markdown-it records line numbers for blocks, but no columns inside a line.
- In mystmd's parse of one sample, roles had no position after transforms, and before transforms their columns ran past the end of the line.
- `[](#x)` links got a placeholder position (column 1 to 1).
- `<#x>` wasn't parsed as a reference.
- `@key` was reported one line early.

### Replacing the reference regexes

A parser such as [myst-parser-unified](https://chrisholdgraf.com/myst-parser-unified/) could replace the reference regexes if it provides:

- Pre-transform myst-spec mdast, so myst-transforms still run on it.
  mystmd's transforms use older majors of unified and vfile, so the parser's trees must still work with them.
- Positions for the parts inside nodes, such as the target in `` {ref}`text <target>` ``, the label in `(x)=`, and directive arguments and options.
- Tolerance of half-typed input, since most documents are mid-edit.
- Enough speed to parse every page in the project for find references.

The swap point is `refsInText` and `labelDefinition` in `src/syntax.ts`, not `mystmd-client/parse`.
`refAt` and `optionAt` read the cursor's context in half-typed text, so they stay regex-based.

`labelChars` leaves out `<>` on purpose, so a rename doesn't end `` {ref}`text <label>` `` early.
`labelDefinition` adds them back when matching `(x)=`, since mystmd allows them there.

## Conformance

`npm run conformance` compares the regexes with mystmd's parse.
See [](contributing.md#conformance) for what it checks, and [](contributing.md#kept-in-sync-by-hand) for the lists it shares with the source.

On myst-spec, in CI:

| Kind | Matched | Missed | False positive |
|---|---|---|---|
| Label roles | 15 | 0 | 0 |
| `{doc}` roles | 0 | 0 | 0 |
| Path links | 8 | 0 | 0 |
| `[](#label)` links | 0 | 0 | 0 |
| Label definitions | 27 | 2 | 0 |

The `{doc}` and `[](#label)` rows are zero because myst-spec has no examples of them.

We fixed known differences with general rules rather than single cases: trimming padded role targets, accepting link titles, and counting Markdown images as path links.
Accepting spaces in `:label:` and `:name:` was reverted, because on real projects it read frontmatter `name:` fields, YAML in code blocks, and option text like a button's `:label:` as label definitions.
The differences left are in `known` at the top of `scripts/conformance.ts`, with the reason for each.

We also ran `MYST_CORPUS=<path> npm run conformance` by hand on 2026-10-13, on a corpus of public MyST projects:

| Kind | Matched | Missed | False positive |
|---|---|---|---|
| Label roles | 729 | 0 | 6 |
| `{doc}` roles | 1 | 0 | 0 |
| Path links | 532 | 0 | 4 |
| `[](#label)` links | 488 | 2 | 17 |
| Label definitions | 525 | 0 | 149 |

Most false positives are noise: `{myst}` example bodies that mystmd keeps as source, code blocks, and frontmatter like a kernel's `name: python3`.
The one real gap is a link written as `[](<url>)` with parentheses in the URL, which the regexes read as a path link.

## The parse-first experiment

The `experiment/parse-first` branch indexes closed files with the live parser instead of the build.
It was never merged, and predates the move of the mystmd helpers to mystmd-client.
These numbers are from `MYST_CORPUS=<path> node scripts/parse-first.ts` on that branch, on the seven projects in the script's `roots`.

- Targets: 1443 were in both, 127 only in the parse (126 of them headings), and 38 only in the build.
  6 files had no built page, so they were left out.
- Enumerators differed on 16 targets, all in mystmd's docs, and all because mystmd-client's `parse` ignores frontmatter `numbering: headings`.
  None differed in notebooks.
- The first project-wide completion took 1.5 s with the parse, against 80.6 s for a cold build and 16.5 s warm.
  These are one sample each, and build times move in 2 s steps because of the content server's reconnect interval.
- A switch would delete the content server wiring: the code that starts mystmd and reads the content server, and the `mystmd-client/start` and `mystmd-client/content-server` imports.
  `git grep -n "mystmd-client/start\|mystmd-client/content-server\|startMyst\|contentServer" packages/server/src` lists it.

So parse-first is viable for targets and enumerators on this corpus, because mystmd also numbers per page.
The gaps are frontmatter `numbering`, mystmd's own warnings for closed files (unknown directives, roles and options), and notebooks without cell ids.

We keep the build because it's the source of truth for what mystmd renders, including what plugins add.

## What we need upstream

- [Column positions in mystmd's parser](https://github.com/jupyter-book/mystmd/issues/2864) would let references come from the tree instead of regexes.
- [A parser switch in mystmd](https://github.com/jupyter-book/mystmd/issues/1705), or a parse-first index, would delete the build path (see the parse-first numbers above).
- `enumerator` and `title` in `myst.xref.json` (U1 in MyST Author's [upstream proposals](https://github.com/choldgraf/myst-author/blob/main/upstream/README.md)) would remove the content server page reads.
- Structured diagnostics from `myst start` (U2 in the same proposals) would let closed files get mystmd's own warnings at their file and line.
- [LSP and editor support](https://github.com/jupyter-book/mystmd/issues/1916) is the mystmd issue this server answers.
- `myst start` [binds IPv6 `localhost` unless `HOST` is set](https://github.com/jupyter-book/mystmd/issues/2254), and mystmd's [build networking issue](https://github.com/jupyter-book/mystmd/issues/2471) is still open.
  That is why mystmd-client's `startMyst` sets `HOST=127.0.0.1`, and why the [configuration page](configuration.md#starting-mystmd) tells you to set it when you start mystmd yourself.
- mystmd exporting the helpers that mystmd-client provides (U8 in the same [upstream proposals](https://github.com/choldgraf/myst-author/blob/main/upstream/README.md)) would let this repository drop mystmd-client, whose README lists them.
