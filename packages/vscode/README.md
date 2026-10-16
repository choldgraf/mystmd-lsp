# MyST Language Server for VS Code

Runs the [mystmd-lsp](https://github.com/choldgraf/mystmd-lsp) language server in VS Code, for the pages of MyST projects, as Markdown files or the Markdown cells of notebooks.
See its [features](https://chrisholdgraf.com/mystmd-lsp/features) for what you get.
Highlighting comes from the [MyST Syntax](https://github.com/choldgraf/myst-syntax) extension, which this one depends on so that one install gives both.
[MyST Author](https://chrisholdgraf.com/myst-author/) builds on this extension to add a live preview.

## Install

Once it is published, search for "MyST Language Server" in the Extensions view.
Until then, build and install the `.vsix` from the repository root:

```sh
npm install
npm run package -w packages/vscode    # writes packages/vscode/mystmd-lsp.vsix
code --install-extension packages/vscode/mystmd-lsp.vsix
```

Until MyST Syntax is published, build and install its `.vsix` from the [myst-syntax](https://github.com/choldgraf/myst-syntax) repository first, since VS Code resolves extension dependencies from its gallery.

## Projects

The extension activates when a workspace folder contains a `myst.yml` anywhere, and the server starts with it.
A `myst.yml` added after that needs a window reload.

Only files that are pages of a MyST project get completion, warnings and navigation.
[Finding the project](https://chrisholdgraf.com/mystmd-lsp/configuration#finding-the-project) says how a file's project is found.

A status bar item follows the active Markdown file or notebook cell.
It shows `MyST: <folder>` when the file is a page of a project, and `MyST: not a page of <folder>` or `MyST: no project` when it isn't.
Click it for a sentence explaining the state.

In an [untrusted workspace](https://code.visualstudio.com/docs/editor/workspace-trust) the server runs without mystmd, since mystmd runs the project's plugins, so the project-wide features are off until you trust the folder.

## Settings

`mystmdLsp.serverPath` runs another build of the server, and `mystmdLsp.execute` runs the project's code when mystmd builds.
The Settings UI describes each.
The extension also turns off VS Code's own Markdown path suggestions (`markdown.suggest.paths.enabled`), since they offer GitHub-style heading slugs that mystmd doesn't use and the server completes files and labels itself.

If you build an extension on this one, [contributing](https://chrisholdgraf.com/mystmd-lsp/contributing#layout) says what `activate()` returns.
