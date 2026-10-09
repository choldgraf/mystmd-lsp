# mystmd-lsp

A language server for [MyST](https://mystmd.org) projects, built on the mystmd engine.
It speaks the [Language Server Protocol](https://microsoft.github.io/language-server-protocol/) (LSP), so it works in any editor with an LSP client.

It reads your whole project through mystmd, so it knows which labels, citations and other targets you can reference.
For VS Code and JupyterLab, [MyST Author](https://chrisholdgraf.com/myst-author/) runs it for you, along with a live preview.

**Warning**: This is experimental and evolving rapidly! See "Project status" below.

## Install

```sh
npm install -g mystmd-lsp
```

This needs Node 22 or newer, and [mystmd](https://mystmd.org/guide/quickstart) for project-wide features.
MyST Author's extensions include the server, so they don't need this step.

## Run

Point your editor's LSP client at `mystmd-lsp --stdio` for Markdown files.
See [editor setup](docs/editors.md) for examples, and [troubleshooting](docs/troubleshooting.md) if something doesn't work.
The [demo project](demo/index.md) walks through each feature.

## What you get

- Completion for references, citations, files, directives, roles and directive options.
- Links to labels and objects in external projects, through `xref`.
- Hover, go to definition, find references, and rename for labels.
- Warnings for unknown references, missing files, and duplicate labels.
- Inline hints about what a reference points to, plus outline and workspace symbols.
- Markdown cells in notebooks, such as JupyterLab or VS Code notebooks.

See [features](docs/features.md) for the full list.

## Inspiration

This takes inspiration from the [myst-lsp project](https://marketplace.visualstudio.com/items?itemName=chrisjsewell.myst-lsp), adapting that approach for the current MyST engine.

## Project status

Currently, this is being developed primarily for its author, Chris Holdgraf, to have VSCode and JupyterLab LSP support for the mystmd engine!
It's also a way to explore how complex it would be to implement some of this core functionality using the capabilities of that engine.
So treat it as part "alpha product", part "prototype for experimentation", and part "hopefully useful tool".
If the Jupyter Book team ever wants to use `mystmd-lsp` for its npm package I'm happy to donate this repository and/or the `mystmd-lsp` npm name to the project!

Note: This is being developed with a fair amount of Claude support, though with a lot of heavy loops of review and design work w/ a human.
