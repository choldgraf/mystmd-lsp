---
title: Features
---

What the server does for your MyST files.
It uses mystmd's own parser and directive specs, so it knows the same directives, roles and options as mystmd.

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
| `/` at the start of a line | a directive template you can tab through |
| `/` after a space | a role template you can tab through |
| `:` on a line inside a directive's options | that directive's options, skipping ones already set |

See [](configuration.md#what-it-reads-from-myst-yml) for where citation keys come from.

Completions show a preview of the target, like a figure's caption or an equation's LaTeX.
Completions for directives and roles show their docs.

Directives and roles from the JavaScript plugins in `myst.yml` complete too, after mystmd's first build.
The server loads them from the same files mystmd loads, so this only works when mystmd runs for the project.
Reload the window after changing a local plugin or adding a new one.

## Hover and go to definition

References get hover and go to definition.
Directive names, directive options and role names get hover with the docs from mystmd's specs, including a directive's argument and options.
`{doc}` references and links to local files, like `[](chapter.md)`, get go to definition when the file exists.
They also get document links, which make the path clickable in the editor.

## File arguments

The file arguments of `figure`, `image`, `include`, and `literalinclude` get document links, go to definition, and a warning when the file doesn't exist.
Like mystmd, paths are relative to the current file, or to the project folder when they start with `/`.
URLs, notebook cells (`#id`), and paths with a `*` wildcard aren't checked.

## Find references and rename

Both work on labels, from a reference or from the label's definition.
A definition is `(label)=`, `:label:`, or `$$ (label)`.
They search the pages mystmd builds (see [](configuration.md#finding-the-project)), using unsaved text for open documents.
Find references also searches the Markdown cells of notebooks on disk.
Rename edits every reference and the definition, but in notebooks only the open cells.
Rename isn't offered for citations, external references, labels in closed notebooks, or headings without an explicit label.

When you move or rename a file or folder in the editor, links to it are updated.
That covers `{doc}` roles, `[](path)` links, and directive file arguments.
Relative links inside what you moved are updated too.
Like rename, it leaves closed notebooks alone.

## Diagnostics

The server warns about references to unknown targets, and labels defined more than once in the project.
Like mystmd, headings without an explicit label can share a name.
It also warns about missing files in directive arguments, such as a `{figure}`'s image, and about broken external references.
`{doc}` references and `[](file.md)` links to missing files aren't reported, since their targets can also be page slugs.
See [](troubleshooting.md) if warnings don't show up.

Open pages also get mystmd's own warnings from parsing them, such as unknown directives, roles and directive options.
If `myst.yml` lists plugins, unknown directives and roles aren't reported, since the server's parser doesn't load plugins.

Editors that pull warnings for the whole workspace also get them for pages and notebook Markdown cells that aren't open (see [](editors.md#how-warnings-reach-your-editor)).

## Inlay hints and semantic tokens

Inlay hints are grey text after each reference that shows what it points to, such as `Figure 1` or `(1)`.
Semantic tokens tell the editor what kind of thing each piece of text is, so the editor can colour it.
Each reference is a `label` token, with its target's kind as a modifier, such as `label.figure`.
Citations are `label.citation`.
See [](configuration.md#semantic-token-colours) to colour them.

## Glossary terms

This covers `` {term}`text` `` and `` {term}`shown <text>` ``.
You get hover with the term's definition, go to definition, find references, and a warning for unknown terms.
Terms are matched as mystmd matches them, ignoring case and quotes.
Rename isn't offered, since a term's label is its text.

## Citations

This covers `@key`, `[@a; @b]`, and `` {cite:p}`a, b` ``.
You get hover with author, year and title, go to definition in the `.bib` file, and diagnostics.
Like mystmd, `@x` is a citation if the bibliography has `x`, else a reference to label `x`.
Unknown keys are only reported when the project has a bibliography and all of it is local files, not URLs.

## Symbols

Workspace symbols let you search every label in every project in the window, by its label or text.
Each symbol is named by its label's identifier, which mystmd lowercases.
Exact matches come first.

Document symbols are the page outline.
Headings are nested by level, and each section lists its labeled figures, tables, equations and so on.

## External references

This covers `[](xref:key#target)` and `<xref:key/page#target>`.
You get completion of keys, pages and targets.
Hover shows the URL a link points to, and an inlay hint shows the remote page's title.
You also get diagnostics and document links.
Keys come from `project.references` in `myst.yml`.
The server fetches each external project's list of targets when the project loads, and again when `myst.yml` changes (see [](configuration.md#what-it-reads-from-myst-yml)).
That list is `myst.xref.json` for a MyST site, or `objects.inv` for a Sphinx site.

## Notebooks

Each Markdown cell is a document in its notebook's file, with all the features above.
Clients can send cells through LSP notebook sync, as VS Code does.
Other clients can open each cell as a document at the notebook's URI with `#<cell id>` on the end.

## Limits

References in code fences, code directives such as `{code-block}`, and inline code are ignored by every feature except completion.
