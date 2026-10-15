# MyST Language Server for VS Code

Runs the [mystmd-lsp](../../README.md) language server in VS Code, for Markdown files and the Markdown cells of notebooks; see its [features](https://chrisholdgraf.com/mystmd-lsp/features).
Highlighting comes from the [MyST Syntax](https://github.com/choldgraf/myst-syntax) extension, which this one depends on.
[MyST Author](https://chrisholdgraf.com/myst-author/) builds on this extension to add a live preview.

## Install

Once it is published, search for "MyST Language Server" in the Extensions view, or install `myst-author.mystmd-lsp-vscode` from the Marketplace.

Until then, build and install the `.vsix` from the repository root:

```sh
npm install
npm run package -w packages/vscode    # writes packages/vscode/mystmd-lsp.vsix
code --install-extension packages/vscode/mystmd-lsp.vsix
```

VS Code resolves extension dependencies from the Marketplace, so until MyST Syntax is published there, build and install its `.vsix` from the [myst-syntax](https://github.com/choldgraf/myst-syntax) repository first.

## Settings

`mystmdLsp.serverPath` runs another build of the server, and `mystmdLsp.execute` runs the project's code when mystmd builds; the Settings UI describes each.
Reload the window after changing them.
The server finds the project from the workspace folder; see [configuration](https://chrisholdgraf.com/mystmd-lsp/configuration).
The extension also turns off VS Code's own Markdown link suggestions (`markdown.suggest.paths.enabled`), which suggest GitHub-style heading slugs that mystmd doesn't use; the server completes files and labels instead.
