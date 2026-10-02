# mystmd-lsp

A language server for [MyST](https://mystmd.org) projects, built on the mystmd engine.
It speaks the [Language Server Protocol](https://microsoft.github.io/language-server-protocol/) (LSP), so it works in any editor with an LSP client, including VS Code and JupyterLab.

It runs a headless `myst` server and rebuilds your documents as you edit, so it knows which labels, citations and other objects you can reference.
The editor packages in this repository wrap the server for VS Code and JupyterLab.

## Install

```sh
npm install -g mystmd-lsp
```

This needs Node 22 or newer, and [mystmd](https://mystmd.org/guide/quickstart) for project-wide features.
Note: The VS Code extension includes the server, so it doesn't need this step; see [editor setup](docs/editors.md).

## Run

Most people will use this as part of a plugin, but some editors let you manually configure an LSP for certain types of files.
To do so, point your editor at `mystmd-lsp --stdio` for Markdown files.
See [editor setup](docs/editors.md) for VS Code and JupyterLab, and [troubleshooting](docs/troubleshooting.md) if something doesn't work.

## Try it locally in VS Code

To see the server working before installing anything, run it from a clone of this repository:

1. Run `npm ci` in the repository root.
2. Open the repository root in VS Code.
3. Press F5 and pick "Demo extension on demo/".
   This builds the server and extension, then opens a second VS Code window on the [demo project](demo/index.md) with both loaded.
4. In the new window, open `index.md` and follow its "Try this" steps.

The first run is slower because mystmd downloads its theme, and the external references need network access.
Wait for "Loading project" to finish before expecting warnings.
After changing the code, press Cmd+Shift+F5 (Ctrl+Shift+F5 on Windows and Linux) to rebuild and reopen the window.
The server's log is in the Output panel, under "MyST".

This needs [mystmd](https://mystmd.org/guide/quickstart) installed.

## Try it locally in JupyterLab

From the repository root, run `npm ci`, then `npm run demo:lab`.
This builds the server and opens JupyterLab on the demo project, in a throwaway [uv](https://docs.astral.sh/uv/) environment with jupyterlab-lsp and this repository's Python package.
Add Jupyter options after `--`, e.g. `npm run demo:lab -- --debug`.

Open `index.md` and follow its steps.
To see the rendered site beside it, run `npm run demo:live` in another terminal.
The server's log is in the terminal running Jupyter.
After changing the code, run `npm run build` and restart the language server from the status bar, no need to restart Jupyter.

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

Currently, this is being developed primarily for Chris to have VSCode and JupyterLab LSP support for the mystmd engine!
It's also a way to explore how complex it would be to implement some of this core functionality using the capabilities of that engine.
So treat it as part "alpha product", part "prototype for experimentation", and part "hopefully useful tool".
If the Jupyter Book team ever wants to use `mystmd-lsp` for its npm package I'm happy to donate this repository and/or the `mystmd-lsp` npm name to the project!

Note: This is being developed with a fair amount of Claude support, though with a lot of heavy loops of review and design work w/ a human.
