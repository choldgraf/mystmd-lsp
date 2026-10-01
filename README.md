# mystmd-lsp

A language server for [MyST](https://mystmd.org) projects, built on the mystmd engine.
It speaks the [Language Server Protocol](https://microsoft.github.io/language-server-protocol/) (LSP), and works in VS Code and JupyterLab.

It uses mystmd's own parser, directive specs and content server (the build server that `myst start --headless` runs), so what it completes and warns about matches what `myst build` does.

## Install

```sh
npm install -g mystmd-lsp
```

This needs Node 22 or newer, and [mystmd](https://mystmd.org/guide/quickstart) for project-wide features.

## Run

Point your editor at `mystmd-lsp --stdio` for Markdown files.
That's all it needs: in a project with a `myst.yml`, the server starts `myst start --headless` itself, so it knows every page, label and citation in the project.
See [editor setup](docs/editors.md) for VS Code and JupyterLab, and [troubleshooting](docs/troubleshooting.md) if something doesn't show up.

## What you get

- Completion for references, citations, files, directives, roles and directive options.
- Hover, go to definition, find references and rename for labels.
- Warnings for unknown references, missing files and duplicate labels.
- Inlay hints, outline and workspace symbols, and support for Markdown cells in notebooks.

See [features](docs/features.md) for the full list.

## Documentation

- [Editor setup](docs/editors.md)
- [Features](docs/features.md)
- [Configuration](docs/configuration.md)
- [How it works](docs/how-it-works.md)
- [Troubleshooting](docs/troubleshooting.md)
- [Contributing](docs/contributing.md)
