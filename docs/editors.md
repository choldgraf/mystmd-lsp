---
title: Editor setup
---

Open your MyST project, the folder with `myst.yml`, as the workspace, so the server can find it.
If warnings don't show up, see [](troubleshooting.md).

## VS Code

Install the [MyST Language Server](https://github.com/choldgraf/mystmd-lsp/tree/main/packages/vscode) extension.
It runs a bundled copy of this server for Markdown files and notebook Markdown cells, and installs [MyST Syntax](https://github.com/choldgraf/myst-syntax) for highlighting.
[MyST Author](https://chrisholdgraf.com/myst-author/) adds a live preview on top of it.

## JupyterLab

[MyST Author](https://chrisholdgraf.com/myst-author/)'s JupyterLab extension runs this server for Markdown files and notebook cells.

For Markdown files only, you can register the server with [jupyterlab-lsp](https://jupyterlab-lsp.readthedocs.io/) instead, in `jupyter_server_config.py`:

```python
c.LanguageServerManager.language_servers = {
    "mystmd-lsp": {
        "version": 2,
        "argv": ["mystmd-lsp", "--stdio"],
        "languages": ["markdown"],
        "mime_types": ["text/markdown", "text/x-markdown"],
        "display_name": "mystmd-lsp",
    }
}
```

jupyterlab-lsp doesn't send notebook Markdown cells to a language server (U11 in MyST Author's [upstream proposals](https://github.com/choldgraf/myst-author/blob/main/upstream/README.md)), so cells only get this server through MyST Author.

## Other editors

Install the server (see [Install](index.md#install)), then point your editor's LSP client at `mystmd-lsp --stdio` for Markdown files.
In a project with a `myst.yml`, the server starts mystmd, so project-wide completion and warnings appear once its first build finishes.

Neovim 0.11 or newer:

```lua
vim.lsp.config('mystmd', {
  cmd = { 'mystmd-lsp', '--stdio' },
  filetypes = { 'markdown' },
  root_markers = { 'myst.yml' },
})
vim.lsp.enable('mystmd')
```

Helix, in `languages.toml`:

```toml
[language-server.mystmd-lsp]
command = "mystmd-lsp"
args = ["--stdio"]

[[language]]
name = "markdown"
language-servers = ["mystmd-lsp"]
roots = ["myst.yml"]
```

`language-servers` replaces Helix's default Markdown servers, so list them too if you use one.

If your client pulls diagnostics, its document selector must include notebook cells.
In VS Code that is `{ notebook: { notebookType: 'jupyter-notebook' }, language: 'markdown' }`.
Without it, open cells only get diagnostics from workspace pulls.
