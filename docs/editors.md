---
title: Editor setup
---

This page shows how to use `mystmd-lsp` in VS Code and JupyterLab.
First [install the server](index.md#install).
In both, open your MyST project, the folder with `myst.yml`, as the workspace, so the server can find it.
If warnings don't show up, see [](troubleshooting.md).

## VS Code

There's no Marketplace release yet, so build the extension from this repository, in [packages/vscode](https://github.com/myst-contrib/mystmd-lsp/tree/main/packages/vscode):

1. Clone this repository, and from its root run `npm ci`, then `npm run package -w packages/vscode`.
2. In VS Code, run "Extensions: Install from VSIX..." and pick the `.vsix` file.
3. Open your project folder as the workspace.

If VS Code can't find the server, set `mystmd.serverPath` to its full path in your VS Code settings.
The extension hasn't been tried in VS Code yet, including Markdown cells in notebooks.

## JupyterLab

You need the server and the Python package, since the package only registers the server:

```sh
npm install -g mystmd-lsp
pip install jupyterlab-lsp jupyter-mystmd-lsp
```

[jupyter-mystmd-lsp](https://github.com/myst-contrib/mystmd-lsp/tree/main/packages/jupyterlab) registers the server with jupyterlab-lsp, so there's no config to write.
jupyterlab-lsp uses the Jupyter server's root folder as the workspace, so start Jupyter in your project folder.
This covers Markdown files opened in the editor.
It hasn't been tried in the JupyterLab UI yet.

To register the server by hand instead, add this to `jupyter_server_config.json`.
If you can't start Jupyter in the project folder, also add `"--root=/path/to/project"` to `argv`; [](configuration.md) explains `--root`.

```json
{
  "LanguageServerManager": {
    "language_servers": {
      "mystmd-lsp": {
        "version": 2,
        "argv": ["mystmd-lsp", "--stdio"],
        "languages": ["markdown"],
        "mime_types": ["text/markdown", "text/x-markdown"]
      }
    }
  }
}
```
