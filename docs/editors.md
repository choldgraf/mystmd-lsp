---
title: Editor setup
---

Open your MyST project, the folder with `myst.yml`, as the workspace, so the server can find it.
If warnings don't show up, see [](troubleshooting.md).

## VS Code and JupyterLab

Use [MyST Author](https://chrisholdgraf.com/myst-author/), whose VS Code and JupyterLab extensions run this server along with a live preview.

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
In VS Code that is `{ language: 'markdown', notebookType: 'jupyter-notebook' }`.
Without it, open cells only get diagnostics from workspace pulls.
