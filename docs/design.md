---
title: What we learned
---

Why the server is built the way it is, what we measured, and what we need upstream.
See [](how-it-works.md) for the short version.

## A build and a live parse

The server reads a project two ways, because neither covers everything.

For closed files, the server gets targets, titles and enumerators from the build.
An enumerator is the number, like the `1` in `Figure 1`.
The server reads the build page by page from `myst start`'s content server.
We can't use `myst.xref.json` instead, because it isn't rewritten on edits and has no `title` or `enumerator`.

Open documents are parsed live with mystmd's parser and its per-page transforms.
Each page is parsed on its own, without the rest of the project.
So an open page's enumerators can differ from the build's when frontmatter sets `numbering`.

Directive transforms drop `position` on the nodes they make (see MyST Author's [data and packaging gaps](https://github.com/choldgraf/myst-author/blob/main/upstream/README.md#data-and-packaging-gaps-file-as-small-bug-reports)).
For the live parse, mystmd-client's `parseMyst` copies the directive's position onto its children.
For built page JSON, `src/index-targets.ts` falls back to the first descendant that has a position.

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

To swap in a parser, replace `refsInText` and `labelDefinition` in `src/syntax.ts`, not `mystmd-client/parse`.
`refAt` and `optionAt` read the cursor's context in half-typed text, so they stay regex-based.

`labelChars` leaves out `<>` on purpose, so a rename doesn't end `` {ref}`text <label>` `` early.
`labelDefinition` adds them back when matching `(x)=`, since mystmd allows them there.

## Conformance

`npm run conformance` compares the regexes with mystmd's parse.
See [](contributing.md#conformance) for what it checks, and run it for the current numbers.

We fixed known differences with general rules rather than single cases.
For example, the regexes trim spaces around role targets, accept link titles, and count Markdown images as path links.

`:label:` and `:name:` values with spaces don't count as label definitions.
When we accepted them, real projects got false labels from frontmatter `name:` fields and YAML in code blocks.
Option text, like a button's `:label:`, also read as a label definition.
The differences left are in `known` at the top of `scripts/conformance.ts`, with the reason for each.

We also ran `MYST_CORPUS=<path> npm run conformance` by hand on 2026-10-13, on a corpus of public MyST projects:

| Kind | Matched | Missed | False positive |
|---|---|---|---|
| Label roles | 729 | 0 | 6 |
| `{doc}` roles | 1 | 0 | 0 |
| Path links | 532 | 0 | 4 |
| `[](#label)` links | 488 | 2 | 17 |
| Label definitions | 525 | 0 | 149 |

Most false positives are noise.
They come from `{myst}` example bodies that mystmd keeps as source, from code blocks, and from frontmatter like a kernel's `name: python3`.
The one real gap is a link written as `[](<url>)` with parentheses in the URL, which the regexes read as a path link.

## The parse-first experiment

The `experiment/parse-first` branch indexes closed files with the live parser instead of the build.
It was never merged.
On seven public projects the parse and the build agreed on nearly every target.
The first project-wide completion took about a second with the parse, and over a minute with a cold build.
The gaps are frontmatter `numbering`, which the live parse ignores, and mystmd's own warnings for closed files.

We keep the build because it's what mystmd actually produces, including what plugins add.

## What we need upstream

This server answers mystmd's [LSP and editor support](https://github.com/jupyter-book/mystmd/issues/1916) issue.
It would be simpler with:

- [Column positions in mystmd's parser](https://github.com/jupyter-book/mystmd/issues/2864), so references can come from the tree instead of regexes.
- [A parser switch in mystmd](https://github.com/jupyter-book/mystmd/issues/1705), or a parse-first index, so the server no longer needs the build.
- [`enumerator` and `title` in `myst.xref.json`](https://github.com/choldgraf/myst-author/blob/main/upstream/U1-richer-xref-entries.md), so the server stops reading pages from the content server.
- [Structured diagnostics from `myst start`](https://github.com/choldgraf/myst-author/blob/main/upstream/U2-structured-diagnostics.md), so closed files get mystmd's own warnings at their file and line.
- [`myst start` listening on IPv4 without `HOST`](https://github.com/jupyter-book/mystmd/issues/2254), so mystmd-client's `startMyst` and the [configuration page](configuration.md#starting-mystmd) can stop setting it.
- [mystmd exporting the helpers in mystmd-client](https://github.com/choldgraf/myst-author/blob/main/upstream/README.md), so this repository can drop it.
