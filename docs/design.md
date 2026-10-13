---
title: What we learned
---

Why the server is built the way it is, what we measured, and what upstream changes would let us delete code.
See [](how-it-works.md) for the short version.

## A build and a live parse

The server reads a project two ways, because neither covers everything.

- **The build.** Closed files' targets, titles and enumerators come from `myst start`, read page by page from the content server (`content-server` in [mystmd-client](https://github.com/choldgraf/mystmd-client)).
  We can't use `myst.xref.json` instead, because it isn't rewritten on edits and has no `title` or `enumerator`.
- **The live parse.** Open documents get `mystParse` plus mystmd's per-page transforms, including `basicTransformationsPlugin` and `enumerateTargetsPlugin`, on that page alone (`parse` in mystmd-client).
  So an open page's enumerators can differ from the build's when frontmatter sets `numbering`.

`src/project.ts` merges the two: an open document's targets replace its file's built ones.

Directive transforms drop `position` on the nodes they make.
mystmd-client's `parse` copies the directive's position onto its children, and `src/index-targets.ts` falls back to the first positioned descendant in built page JSON.

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
- Speed enough to parse every page in the project for find references.

The swap point is `refsInText` and `labelDefinition` in `src/syntax.ts`, not `parse.ts`.
`refAt` and `optionAt` read the cursor's context in half-typed text, so they stay regex-based.

`labelChars` leaves out `<>` on purpose, so a rename doesn't end `` {ref}`text <label>` `` early.
`labelDefinition` adds them back for `(x)=`, which mystmd allows.

## Conformance

`npm run conformance` compares the regexes with mystmd's parse; see [](contributing.md#conformance) for what it checks.

On myst-spec, in CI:

| Kind | Matched | Missed | False positive |
|---|---|---|---|
| Label roles | 15 | 0 | 0 |
| `{doc}` roles | 0 | 0 | 0 |
| Path links | 8 | 0 | 0 |
| `[](#label)` links | 0 | 0 | 0 |
| Label definitions | 29 | 0 | 0 |

The CI check started with 8 known differences: kept spaces, link titles, labels with spaces, and images.
We fixed general rules rather than single cases: trimming padded role targets, accepting link titles, and counting Markdown images as path links.
Accepting spaces in `:label:` and `:name:` was reverted, because on real projects it read frontmatter `name:` fields, YAML in code blocks, and option text like a button's `:label:` as label definitions.
So the list has two entries left, both labels with spaces.

We also ran it on a corpus: clones of mystmd, Jupyter Book, 2i2c's docs and example-outputs, plus copies of our own docs.
These numbers are from a clean run on 2026-10-13, on the corpus listed in `.ai/myst-project-examples/SOURCES.md` in the workspace above this repository:

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
It was never merged.
On the seven corpus projects:

- **Targets**: 1443 in both, 127 only in the parse (126 of them headings), and 38 only in the build.
  6 files had no built page, so they were left out.
- **Enumerators** differ on 16 targets, all in mystmd's docs, and all because `parse.ts` ignores frontmatter `numbering: headings`.
  None differ in notebooks.
- **Time to the first project-wide completion**: 1.5 s for the parse, against 80.6 s for a cold build and 16.5 s warm.
  These are one sample each, and build times move in 2 s steps because of the content server's reconnect interval.
- **Code**: a switch would delete 176 lines (`start.ts`, `start.test.ts`, `content-server.ts`, and parts of `server.ts` and its test), change about 54, and grow `project.ts` by 11.

So parse-first is viable for targets and enumerators on this corpus, because mystmd also numbers per page.
The gaps are frontmatter `numbering`, mystmd's own warnings for closed files (unknown directives, roles and options), and notebooks without cell ids.

We keep the build because it's the source of truth for what mystmd renders, including what plugins add.

## What would let us delete code

- **Column positions in mystmd's parser** ([mystmd#2864](https://github.com/jupyter-book/mystmd/issues/2864)) would let references come from the tree instead of regexes.
- **A client exported by mystmd** (U8 in MyST Author's [upstream proposals](https://github.com/choldgraf/myst-author/blob/main/upstream/README.md)) would replace mystmd-client.
- **A parser switch in mystmd** ([mystmd#1705](https://github.com/jupyter-book/mystmd/issues/1705)), or a parse-first index, would delete the build path; see the parse-first numbers above.
- **`enumerator` and `title` in `myst.xref.json`** (U1 in the same proposals) would remove the content server page reads.
