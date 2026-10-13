---
title: What we learned
---

Why the server is built the way it is, what we measured, and what upstream changes would let us delete code.
See [](how-it-works.md) for the short version.

## A build and a live parse

The server reads a project two ways, because neither covers everything.

- **The build.** Closed files' targets, titles and project-wide enumerators come from `myst start`, read page by page from the content server (`src/mystmd/content-server.ts`).
  We can't use `myst.xref.json` instead, because it isn't rewritten on edits and has no `title` or `enumerator`.
- **The live parse.** Open documents get `mystParse` plus mystmd's per-page transforms, including `basicTransformationsPlugin` and `enumerateTargetsPlugin`, on that page alone (`src/mystmd/parse.ts`).
  So an open page's enumerators can differ from the build's, which numbers across the project.

`src/project.ts` merges the two: an open document's targets replace its file's built ones.

Directive transforms drop `position` on the nodes they make.
`parse.ts` copies the directive's position onto its children, and `src/index-targets.ts` falls back to the first positioned descendant in built page JSON.

## References come from regexes

mystmd's parser finds targets and warnings, but regexes in `src/syntax.ts` find where each reference is.
The parse tree doesn't give us usable positions:

- markdown-it records line numbers for blocks, but no columns inside a line.
- In mystmd's parse of one sample, roles had no position after transforms, and before transforms their columns ran past the end of the line.
- `[](#x)` links got a placeholder position (line 4, column 1 to 1).
- `<#x>` wasn't parsed as a reference.
- `@key` was reported one line early.

The regexes also have to work on half-typed input, since most documents are mid-edit.

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

myst-spec has no `{doc}` role or `[](#label)` examples.
The CI check started with 8 known differences: kept spaces, link titles, labels with spaces, and images.
That list is now empty, after fixing general rules rather than single cases: trimming padded role targets, accepting link titles, accepting spaces in `:label:` and `:name:`, and counting Markdown images as path links.

We also ran it on a corpus of seven projects: the mystmd, Jupyter Book and 2i2c docs, example-outputs, myst-parser-unified's docs, and this repository's docs and demo.
These numbers are from before the fixes above:

| Kind | Matched | Missed | False positive |
|---|---|---|---|
| Label roles | 735 | 0 | 6 |
| `{doc}` roles | 2 | 0 | 0 |
| Path links | 523 | 0 | 20 |
| `[](#label)` links | 454 | 2 | 53 |
| Label definitions | 533 | 0 | 149 |

Most false positives are noise: `{myst}` example bodies that mystmd keeps as source, code blocks, and frontmatter.
The real gaps were images and `<url>` counted as path links, links with titles, and references on directive lines.
To get current numbers, run `MYST_CORPUS=path/to/projects npm run conformance`.

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

The server hasn't switched.
We keep the build because it's the source of truth for what mystmd renders, including what plugins add.

## What would let us delete code

- **Column positions in mystmd's parser** ([mystmd#2864](https://github.com/jupyter-book/mystmd/issues/2864)) would let references come from the tree instead of regexes.
- **A client exported by mystmd** (U8 in MyST Author's [upstream proposals](https://github.com/choldgraf/myst-author/blob/main/upstream/README.md), and a draft for a shared package) would delete `parse.ts`, `start.ts` and `content-server.ts`, which are copies of MyST Author's.
- **A parser switch in mystmd** ([mystmd#1705](https://github.com/jupyter-book/mystmd/issues/1705)), or a parse-first index, would delete the build path, with the numbers above.
- **`enumerator` and `title` in `myst.xref.json`** (U1 in the same proposals) would remove the content server page reads.
