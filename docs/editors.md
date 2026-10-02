---
title: Editor setup
---

Open your MyST project, the folder with `myst.yml`, as the workspace, so the server can find it.
If warnings don't show up, see [](troubleshooting.md).

## VS Code and JupyterLab

Use [MyST Author](https://github.com/choldgraf/myst-author), whose VS Code and JupyterLab extensions run this server along with a live preview.
Its VS Code extension can run your own build of the server instead of its bundled copy, which is handy while working on the server; see [](contributing.md).

## Other editors

Install the server (see the [README](index.md)), then point your editor's LSP client at `mystmd-lsp --stdio` for Markdown files.

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
```

## Preview the built site

To see how references render, run `myst start` in your project and open the site it prints.
MyST Author's extensions also show a preview beside your editor.
