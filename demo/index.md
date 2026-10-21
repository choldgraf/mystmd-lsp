---
title: Try mystmd-lsp
---

A guided tour of what the language server does.
Each page has **Try this** boxes: do what they say, and check that you get what they describe.

:::{note} Before you start
- The first time, mystmd downloads its theme and builds the project.
  Warnings and project-wide completion only appear after that.
  In VS Code, wait for "Loading demo" in the status bar to finish.
  JupyterLab doesn't show this progress.
- References are coloured by kind (figure, table, equation, heading, citation) and followed by grey text saying what they point to.
  Those are semantic tokens and inlay hints.
  This folder's `.vscode/settings.json` turns them on.
- If something doesn't work, check the server log (in VS Code, the Output panel's "MyST Language Server" channel).
:::

## The tour

1. [](1-references.md): completion, hover, go to definition, find references, rename.
2. [](2-citations.md): `@key` and `{cite}` from a `.bib` file.
3. [](3-directives.md): directives, roles, options, and file arguments.
4. [](4-external.md): `xref:` links to other MyST and Sphinx sites.
5. [](5-warnings.md): the warnings, each one on purpose.
6. `notebook.ipynb`: everything above, in a notebook's Markdown cells.
   This works in VS Code, or in JupyterLab with MyST Author, but not through jupyterlab-lsp on Binder.

Also try the outline and workspace symbols on any page (Cmd+Shift+O and Cmd+T in VS Code).
