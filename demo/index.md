---
title: Try mystmd-lsp
---

A guided tour of what the language server does.
Each page has **Try this** boxes: do what they say, and check that you get what they describe.

:::{note} Before you start
- The first time, mystmd downloads its theme and builds the project, so wait for "Loading project" in the status bar to finish.
  Warnings and project-wide completion only appear after that.
- References are coloured by kind (figure, table, equation, heading, citation) and followed by grey text saying what they point to.
  Those are semantic tokens and inlay hints, and this folder's settings turn them on.
- If something doesn't work, open the Output panel and pick "MyST" to see the server log.
:::

## The tour

1. [](1-references.md): completion, hover, go to definition, find references, rename.
2. [](2-citations.md): `@key` and `{cite}` from a `.bib` file.
3. [](3-directives.md): directives, roles, options, and file arguments.
4. [](4-external.md): `xref:` links to other MyST and Sphinx sites.
5. [](5-warnings.md): the warnings, each one on purpose.
6. `notebook.ipynb`: everything above, in a notebook's Markdown cells.

Also try the outline (Cmd+Shift+O) and workspace symbols (Cmd+T) on any page.
