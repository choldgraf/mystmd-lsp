---
title: Troubleshooting
---

## No warnings or completions for other pages

These need mystmd's content server, so most gaps mean it isn't running or the project hasn't finished loading.
Check that:

- the file is a page of a project, and `project.toc` or `project.exclude` doesn't leave it out (see [](configuration.md#finding-the-project)),
- `myst` is installed, and `myst start` works in the project folder,
- you didn't pass `--no-myst`, and in VS Code the folder is trusted,
- the project has finished loading.

In VS Code, the status bar item says whether the file is a page of a project (see [](vscode.md)).
MyST Author's web editor and JupyterLab extension don't show the {gui}`Loading <folder>` progress, so a project can still be loading when it looks idle.
See [](how-it-works.md) for why the server works this way.

## No citation warnings

Unknown citation keys are only reported when every bibliography file is local (see [](features.md#citations)).
