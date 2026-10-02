---
title: Editor setup
---

This page shows how to use `mystmd-lsp` in VS Code and JupyterLab.
In both, open your MyST project, the folder with `myst.yml`, as the workspace, so the server can find it.
If warnings don't show up, see [](troubleshooting.md).

## VS Code

The extension isn't on the Marketplace yet, so install it from a `.vsix` file:

1. Download the `.vsix` from the latest `vscode-v*` [release](https://github.com/choldgraf/mystmd-lsp/releases), or with `gh`:

   ```sh
   gh release download --repo choldgraf/mystmd-lsp --pattern '*.vsix' vscode-v0.1.0
   ```

2. In VS Code, run {gui}`Extensions: Install from VSIX...` and pick that file, or run `code --install-extension mystmd-vscode-0.1.0.vsix`.
   This also works in Cursor, VSCodium and other VS Code forks.
3. Open your project folder as the workspace.

It doesn't update itself, so repeat these steps for a new release.
For a build of the latest commit on `main`, download `mystmd-vscode.vsix` from the [`latest` release](https://github.com/choldgraf/mystmd-lsp/releases/tag/latest), or run `npm run install:vscode` from the repository root to download and install it.
To build the `.vsix` from source instead, run `npm ci`, then `npm run package -w packages/vscode`, from the repository root.

The extension includes the server, so the only other thing to install is [mystmd](https://mystmd.org/guide/quickstart), for project-wide features.
It also highlights MyST syntax.
This is inspired by the [myst-highlight](https://marketplace.visualstudio.com/items?itemName=ExecutableBookProject.myst-highlight) extension but is a separate implementation, kept up to date with mystmd.
Both highlight the same syntax, so turn one of them off.
To use your own build of the server, set `mystmd.serverPath` and reload the window.
The extension turns off VS Code's built-in Markdown link suggestions (`markdown.suggest.paths.enabled`), since the server suggests the same files and headings along with the rest of the project's labels.

These commands are in the {gui}`Command Palette`:

- {gui}`MyST: Start preview` opens the built site beside your source, using the `myst` process the server already runs.
- {gui}`MyST: Restart language server` restarts the server.
- {gui}`MyST: Show language server log` opens the server's output.

## JupyterLab

You need the server and the Python package, since the package only registers the server:

```sh
npm install -g mystmd-lsp
pip install jupyterlab-lsp jupyter-mystmd-lsp
```

For a build of the latest commit on `main`, run `npm run install:jupyterlab` from the repository root instead.

[jupyter-mystmd-lsp](https://github.com/choldgraf/mystmd-lsp/tree/main/packages/jupyterlab) registers the server with jupyterlab-lsp, so there's no config to write.
jupyterlab-lsp uses the Jupyter server's root folder as the workspace, so start Jupyter in your project folder.
This covers Markdown files opened in the editor.

:::{note} Markdown cells in notebooks aren't supported in JupyterLab yet
They should work in VSCode though - I can't figure out why it doesn't work in JupyterLab!
:::

Press Tab to see completions, or turn on {gui}`Settings → Code Completion → Enable autocompletion` to see them as you type.

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

## Preview the built site

To see how references render, open the built site beside your editor.
It rebuilds when you save.
In VS Code, run {gui}`MyST: Start preview`.
In JupyterLab, the server's log, in the terminal running Jupyter, prints the site's address; open it in a browser window.
