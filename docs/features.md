---
title: Features
---

What the server does for your MyST files.
It uses mystmd's own parser and directive specs, so what it completes and warns about matches what `myst build` does.

## Completion

| Typing | Completes |
|---|---|
| `` {ref}` ``, `` {numref}` ``, `` {eq}` ``, `[](#`, `<#` | reference targets |
| `@`, `[@` | citation keys and reference targets |
| `` {cite}` `` | citation keys |
| `` {doc}` ``, `[](` | files, relative to the current file |
| ```` ```{figure} ````, `{image}`, `{include}`, `{literalinclude}` argument | any file, relative to the current file |
| ```` ```{ ````, `:::{` | directive names |
| `{` | role names |
| `:` on a line inside a directive's options | that directive's options, skipping ones already set |

Directive options come from mystmd's directive specs.
Citation keys come from `project.bibliography` in `myst.yml`, or every `.bib` file in the project, as in mystmd.
See [](configuration.md#what-it-reads-from-myst-yml) for when they're re-read.

## Hover and go to definition

- **References**: hover and go to definition.
- **Directive names, directive options, and role names**: hover shows the docs from mystmd's specs.
- **`{doc}` references and links to local files** (`[](chapter.md)`): document links and go to definition, when the file exists.

## File arguments

The file arguments of `figure`, `image`, `include`, and `literalinclude` get document links, go to definition, and a warning when the file doesn't exist.
Like mystmd, paths are relative to the current file, or to the project root when they start with `/`.
URLs, notebook cells (`#id`), and `.*` wildcards aren't checked.

## Find references and rename

Both work on labels, from a reference or from the label's definition (`(label)=`, `:label:`, `$$ (label)`).
They search the project's `.md` files on disk, using unsaved text for open documents.
Rename edits every reference and the definition.
It isn't offered for citations, external references, notebooks, or headings without an explicit label.

## Diagnostics

The server warns about references to unknown targets, and labels defined more than once in the project.
These are only reported with a content server, once the project has loaded; see [](troubleshooting.md) if you don't see them.
Like mystmd, headings without an explicit label can share a name.

## Inlay hints and semantic tokens

- **Inlay hints** show the resolved text after each reference, e.g. `Figure 1` or `(1)`.
- **Semantic tokens** make each reference a `label` token, with its target's kind as a modifier (`label.figure`, `label.table`, `label.equation`, `label.heading`, ...), or `label.citation` for citations.
  See [](configuration.md#semantic-token-colours) to colour them.

## Citations

This covers `@key`, `[@a; @b]`, and `` {cite:p}`a, b` ``.
You get hover with author, year and title, go to definition in the `.bib` file, and diagnostics.
Like mystmd, `@x` is a citation if the bibliography has `x`, else a reference to label `x`.
Unknown keys are only reported when every bibliography file is local, so projects without a `.bib` get no citation warnings.

## Symbols

- **Workspace symbols**: every label, searchable by label or text, so clients can jump to them.
  Each symbol is named by its lowercased label, which hosts rely on to find a label's definition.
- **Document symbols**: the page outline, with headings nested by level and each section's labeled figures, tables, equations, ... under it.

## External references

This covers `[](xref:key#target)` and `<xref:key/page#target>`.
You get completion of keys, pages and targets, hover with the resolved URL, inlay hints with the remote title, diagnostics, and document links.
Keys come from `project.references` in `myst.yml`.
Each project's `myst.xref.json` (MyST) or `objects.inv` (Sphinx) is fetched on `initialize`.

## Notebooks

Each Markdown cell is a document in its notebook's file, with all the features above.
VS Code's notebook sync sends cells as they are.
Find references and rename search open cells, not notebooks on disk.

## Limits

References inside code (fenced blocks, `{code-block}`, inline code) get no diagnostics, hover, or inlay hints.
