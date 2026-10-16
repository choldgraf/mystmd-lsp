---
title: Troubleshooting
---

## No warnings or completions for other pages

These need mystmd's content server, so most gaps mean it isn't running or the project hasn't finished loading.
Check that:

- the file belongs to a project and is a page of it, so not left out by `project.toc` or `project.exclude` (see [](configuration.md#finding-the-project)),
- `myst` is installed, and `myst start` works in the project folder,
- you didn't pass `--no-myst`,
- the project has finished loading.

In VS Code, the status bar item says whether the file is a page of a project (see [](vscode.md)).
MyST Author's web editor and JupyterLab don't show the {gui}`Loading <folder>` progress, so a project can still be loading when it looks idle.
See [](how-it-works.md) for why the server works this way.

## No citation warnings

Unknown citation keys are only reported when every bibliography file is local (see [](features.md#citations)).
