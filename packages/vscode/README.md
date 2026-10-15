# MyST Language Server for VS Code

Runs the [mystmd-lsp](https://github.com/choldgraf/mystmd-lsp) language server in VS Code, for Markdown files and the Markdown cells of notebooks; see its [features](https://chrisholdgraf.com/mystmd-lsp/features).
Highlighting comes from the [MyST Syntax](https://github.com/choldgraf/myst-syntax) extension, which this one depends on so that one install gives both.
[MyST Author](https://chrisholdgraf.com/myst-author/) builds on this extension to add a live preview.

## Install

Until it is published, build and install the `.vsix` from the repository root; after that, search for "MyST Language Server" in the Extensions view.

```sh
npm install
npm run package -w packages/vscode    # writes packages/vscode/mystmd-lsp.vsix
code --install-extension packages/vscode/mystmd-lsp.vsix
```

Until MyST Syntax is published, build and install its `.vsix` from the [myst-syntax](https://github.com/choldgraf/myst-syntax) repository first, since VS Code resolves extension dependencies from its gallery.

## Settings

`mystmdLsp.serverPath` runs another build of the server, and `mystmdLsp.execute` runs the project's code when mystmd builds; the Settings UI describes each.
The server finds the project from the workspace folder; see [configuration](https://chrisholdgraf.com/mystmd-lsp/configuration).
The extension also turns off VS Code's own Markdown path suggestions (`markdown.suggest.paths.enabled`), since they offer GitHub-style heading slugs that mystmd doesn't use and the server completes files and labels itself.
