# mystmd-lsp

A language server for [MyST](https://mystmd.org) projects, built on the mystmd engine.
This implements the [Language Server Protocol](https://microsoft.github.io/language-server-protocol/) (LSP) so that it can be used across editors like VS Code and JupyterLab.

This project leverage's the [MyST Document Engine](https://mystmd.org) to create an index of objects that are available for referencing or labeling.
MyST is designed with modular, machine-readable content in mind, and the goal of this project is to leverage that structure to make it easier to write MyST documents in an editor.

It works by running a headless `myst` server under the hood, and updating its index of objects for referencing by letting the server re-build the MyST documents in real-time.
It also comes bundled with a few editor-specific packages to use this LSP in their own plugins.

## Install

```sh
npm install -g mystmd-lsp
```

This needs Node 22 or newer, and [mystmd](https://mystmd.org/guide/quickstart) for project-wide features.

## Run

Most people will use this as part of a plugin, but some editors let you manually configure an LSP for certain types of files.
To do so, point your editor at `mystmd-lsp --stdio` for Markdown files.
See [editor setup](docs/editors.md) for VS Code and JupyterLab, and [troubleshooting](docs/troubleshooting.md) if something doesn't work.

## Features this should enable

Here are a few common editor features that this is meant to enable:

- Completion for references, citations, files, directives, roles and directive options. There are many kinds of "objects" within MyST, and this should expose as much of them as we can.
- Support for _external references and objects_ as well, via the `xref` mechanism.
- Hover, go to definition, find references, and rename for labels.
- Warnings for unknown references, missing files, and duplicate labels.
- Inline hints about what a reference points to, outline and workspace symbols
- Support for Markdown cells in notebooks like JupyterLab or vscode notebooks.

See [features](docs/features.md) for the full list.

## Inspiration

This takes inspiration from the [myst-lsp project](https://marketplace.visualstudio.com/items?itemName=chrisjsewell.myst-lsp), adapting that approach for the modern MyST engine.
