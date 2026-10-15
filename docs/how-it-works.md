---
title: How it works
---

## The whole picture

Three processes take part: your editor, this server, and mystmd's `myst start`, which builds the project and serves the result from a content server.
Inside the server, `src/server.ts` speaks LSP to the editor and hands each request to `src/service.ts`, which has the features.
`service.ts` finds references in the text with the regexes in `src/syntax.ts`, and looks up what they point to in the index in `src/project.ts`.
The index is filled as described in [](#two-sources-of-truth).
`service.diagnostics` computes a document's diagnostics when asked: unresolved references, duplicate labels in the index, and mystmd's own warnings from the live parse.

```{mermaid}
flowchart LR
  editor[Editor] <-->|LSP over stdio| server
  subgraph lsp [mystmd-lsp]
    server[server.ts<br>LSP wiring] --> service[service.ts<br>features]
    syntax[syntax.ts<br>reference regexes] --> service
    service --> project[project.ts<br>the index]
    parse[parseMyst<br>mystmd-client/parse] -->|live parse of open documents| project
  end
  myst[myst start<br>content server] -->|built page JSON<br>mystmd-client/content-server| project
```

## On a keystroke

1. The editor sends the change, and `server.ts` passes the document's new text to `service.update`.
2. `service.update` waits until typing has stopped for 150 ms, then calls `project.setOpen`.
3. `setOpen` re-parses the document with `parseMyst` and replaces that document's targets and mystmd warnings, keyed by its URI.
4. `setOpen` then calls its `onChange`, which is `refresh` in `server.ts` and also runs when the content server reports a rebuild.
5. `refresh` pushes `service.diagnostics` for every open document with `sendDiagnostics`, unless the editor pulls diagnostics.
   An editor that pulls is asked to pull again if it supports that, and gets the same `service.diagnostics` back.

## On a hover or rename

Take the cursor on `label` in `` {ref}`label` ``.

1. `server.ts` passes the request to `service.hover` or `service.rename`.
2. `refsInText` in `syntax.ts` finds every reference in the document, and the service picks the one whose span holds the cursor.
3. `resolveRef` normalizes the label as mystmd does and looks it up in `project.targets()`.
4. Hover replies with the target's title, file and text, such as `Figure 1 · chapter.md`.
5. Rename finds the label's definition with `labelDefinition` and its references in the project's `.md` files and open documents.
   It replies with the edits, and the editor applies them.

## Notebooks

Each Markdown cell of an open notebook is its own document, at the notebook's path with the cell id as the fragment, like `file:///nb.ipynb#<cell id>` from JupyterLab.
The index keys open documents by URI, so each cell has its own live targets.
For find references and workspace diagnostics, `markdownCells` in `service.ts` splits notebooks on disk into their Markdown cells.
Rename and file moves only edit open cells; see [](features.md#find-references-and-rename) for why.

## To add a reference kind

1. Add its pattern to `refPatterns` and its name to the `kind` of `Ref` in `src/syntax.ts`, and to `contexts` if it should complete.
2. Resolve it in `resolveRef` in `src/service.ts`, and add its completions under its trigger in `completion`.
3. If it points at a new kind of target, give that kind a completion icon in `src/kinds.ts` and a modifier in `semanticTokensLegend` in `src/service.ts`.
4. If mystmd's parse shows it, add it to `kinds` in `scripts/conformance.ts`.
5. Add a test to `src/syntax.test.ts` for the pattern, or to `src/service.test.ts` for the feature.
6. Document it in [](features.md).
7. Run `npm test` and `npm run conformance`.

Other lists change with it; see [](contributing.md#kept-in-sync-by-hand).

## Two sources of truth

- **The content server.** In a project with a `myst.yml`, the server starts `myst start --headless`, which builds every page and serves a content server.
  Clients that already run mystmd pass its address with `--content-server` instead.
  The server indexes the result, so it knows every page, label and citation.
  It reloads the index when the content server reports a change.
  Warnings for unknown targets and completion of labels from other pages need this.
- **Open documents.** These are re-parsed live with mystmd's parser, so unsaved labels are available immediately.
  `targets()` in `src/project.ts` merges the two: an open document's targets replace its file's built ones.

Without a content server, only open documents are indexed, and unknown targets aren't reported.
That happens when there's no `myst.yml`, when mystmd isn't installed or fails to start, or when you pass `--no-myst`.
See [](configuration.md) for the flags.

See [](design.md) for why it works this way, and what we measured.
