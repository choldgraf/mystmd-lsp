---
title: Features
---

What the server does for your MyST files.
It uses mystmd's own parser and directive specs, so it knows the same directives, roles and options as mystmd, except ones that plugins add.

## Completion

| Typing | Completes |
|---|---|
| `` {ref}` ``, `` {numref}` ``, `` {eq}` ``, `[](#`, `<#` | reference targets |
| `@`, `[@` | citation keys and reference targets |
| `` {cite}` `` | citation keys |
| `` {term}` `` | glossary terms |
| `` {doc}` ``, `[](` | Markdown and notebook files, relative to the current file |
| ```` ```{figure} ````, `{image}`, `{include}`, `{literalinclude}` argument | any file, relative to the current file |
| ```` ```{ ````, `:::{` | directive names |
| `{` | role names |
| `/` at the start of a line, or `/name` after a space | a directive (start of a line only) or role, inserted as a template you can tab through |
| `:` on a line inside a directive's options | that directive's options, skipping ones already set |

See [](configuration.md#what-it-reads-from-myst-yml) for where citation keys come from.

## Hover and go to definition

- **References**: hover and go to definition.
- **Directive names, directive options, and role names**: hover shows the docs from mystmd's specs.
- **`{doc}` references and links to local files** (`[](chapter.md)`): document links and go to definition, when the file exists.

## File arguments

The file arguments of `figure`, `image`, `include`, and `literalinclude` get document links, go to definition, and a warning when the file doesn't exist.
Like mystmd, paths are relative to the current file, or to the project root when they start with `/`.
URLs, notebook cells (`#id`), and paths with a `*` wildcard aren't checked.

## Find references and rename

Both work on labels, from a reference or from the label's definition (`(label)=`, `:label:`, `$$ (label)`).
They search the project's `.md` files on disk, using unsaved text for open documents.
Find references also searches the Markdown cells of notebooks on disk.
Rename edits every reference and the definition, but in notebooks only the open cells.
The editor owns a notebook's cells and may hold its file open, so the server can't safely rewrite the notebook's JSON.
Rename isn't offered for citations, external references, labels in closed notebooks, or headings without an explicit label.

When you move or rename a file or folder in the editor, the `{doc}` roles, `[](path)` links, and directive file arguments that point to it are updated, and so are the relative ones in it.
Like rename, it leaves closed notebooks alone.

## Diagnostics

The server warns about references to unknown targets, and labels defined more than once in the project.
Directive arguments that point to missing files, such as a `{figure}`'s image, and broken external references are reported right away.
`{doc}` references and `[](file.md)` links to missing files aren't reported.
Unknown targets and duplicate labels need a [content server](how-it-works.md), so they wait until the project has loaded; see [](troubleshooting.md) if you don't see them.
Like mystmd, headings without an explicit label can share a name.

Open pages also get mystmd's own warnings from parsing them, such as unknown directives, roles and directive options.
If `myst.yml` lists plugins, unknown directives and roles aren't reported, since the server's parser doesn't load plugins.

Editors that support pull diagnostics ask the server for them; other editors get them pushed as each page changes.
Editors that pull workspace diagnostics also get them for the project's `.md` files and notebook Markdown cells on disk, not just open ones.

## Inlay hints and semantic tokens

- **Inlay hints** show the resolved text after each reference, e.g. `Figure 1` or `(1)`.
- **Semantic tokens** make each reference a `label` token, with its target's kind as a modifier, such as `label.figure`.
  Citations are `label.citation`.
  See [](configuration.md#semantic-token-colours) to colour them.

## Glossary terms

`` {term}`text` `` and `` {term}`shown <text>` `` get hover with the term's definition, go to definition, find references, and a warning for unknown terms.
Terms are matched as mystmd matches them, ignoring case and quotes.
Rename isn't offered, since a term's label is its text.

## Citations

This covers `@key`, `[@a; @b]`, and `` {cite:p}`a, b` ``.
You get hover with author, year and title, go to definition in the `.bib` file, and diagnostics.
Like mystmd, `@x` is a citation if the bibliography has `x`, else a reference to label `x`.
Unknown keys are only reported when every bibliography file is local, so projects without a `.bib` get no citation warnings.

## Symbols

- **Workspace symbols**: every label, searchable by its label or text.
  Each symbol is named by its label's identifier, which mystmd lowercases.
  Exact matches come first, since clients use them to find a label's definition.
- **Document symbols**: the page outline, with headings nested by level and each section's labeled figures, tables, equations, ... under it.

## External references

This covers `[](xref:key#target)` and `<xref:key/page#target>`.
You get completion of keys, pages and targets, hover with the resolved URL, inlay hints with the remote title, diagnostics, and document links.
Keys come from `project.references` in `myst.yml`.
Each project's `myst.xref.json` (MyST) or `objects.inv` (Sphinx) is fetched when the server starts.

## Notebooks

Each Markdown cell is a document in its notebook's file, with all the features above.
Clients can send cells through LSP notebook sync, as VS Code does.
Other clients can open each cell as a document whose URI is the notebook's, with the cell id as the fragment.

## Limits

References in code fences, code directives such as `{code-block}`, and inline code are ignored by every feature except completion.
