---
title: Editor setup
---

Open your MyST project, or a folder holding several, as the workspace.
See [](configuration.md#finding-the-project) for which project each file belongs to.
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

The repository's [Binder config](https://github.com/choldgraf/mystmd-lsp/blob/main/binder/jupyter_server_config.py) is a working copy of this, on the demo project.

jupyterlab-lsp doesn't send notebook Markdown cells to a language server, so cells only get this server through MyST Author.

## Other editors

Install the server (see [Install](index.md#install)), then point your editor's LSP client at `mystmd-lsp --stdio` for Markdown files.
The configurations below tell the editor that a folder with a `myst.yml` is a project root.
So the editor sends the project folder as the workspace folder, and the server starts mystmd there.
Project-wide completion and warnings appear once its first build finishes.

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

(how-warnings-reach-your-editor)=
## How warnings reach your editor

LSP has two ways to deliver warnings (diagnostics).
With push, the server sends them on its own whenever a page changes.
With pull, the editor asks the server for them.

The server pushes warnings until your editor first pulls them.
Then it stops pushing, so you don't see each warning twice.
It waits for a real pull rather than trusting the editor's `textDocument.diagnostic` capability.
That's because `@codemirror/lsp-client` advertises that capability but never pulls.

An editor can also pull warnings for the whole workspace.
Then it gets them for pages and notebook Markdown cells on disk, not just open ones, across every project in the window.

If you write an LSP client that pulls diagnostics, its document selector must include notebook cells.
In VS Code that is `{ notebook: { notebookType: 'jupyter-notebook' }, language: 'markdown' }`.
Without it, open cells only get warnings when the client pulls for the whole workspace.
