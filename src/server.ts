#!/usr/bin/env node
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { createConnection, DidChangeWatchedFilesNotification, NotebookDocuments, ProposedFeatures, TextDocuments, TextDocumentSyncKind, type WorkDoneProgressServerReporter } from 'vscode-languageserver/node';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { contentServer } from './mystmd/content-server.ts';
import { startMyst } from './mystmd/start.ts';
import { createProject } from './project.ts';
import { findProjectRoot } from './root.ts';
import { createService, semanticTokensLegend } from './service.ts';
import { readReferences, syncXrefs, type XrefProject } from './xref.ts';

const args = parseArgs({ strict: false, options: { 'content-server': { type: 'string' }, root: { type: 'string' }, 'no-myst': { type: 'boolean' }, help: { type: 'boolean', short: 'h' } } }).values as { 'content-server'?: string; root?: string; 'no-myst'?: boolean; help?: boolean };
if (args.help) {
  console.log('Usage: mystmd-lsp --stdio [--root=path/to/project] [--content-server=URL] [--no-myst]\nSee https://chrisholdgraf.com/mystmd-lsp/configuration');
  process.exit(0);
}

// The LSP wiring: features live in service.ts.
const connection = createConnection(ProposedFeatures.all);
const documents = new TextDocuments(TextDocument);
// Notebooks from clients with notebook sync (VS Code): each Markdown cell is a document.
const notebooks = new NotebookDocuments(TextDocument);
const cells = notebooks.cellTextDocuments;
let service: ReturnType<typeof createService>;
// True until mystmd's first build is indexed; until then there are no project-wide completions or warnings.
let loading = false;
let progress: WorkDoneProgressServerReporter | undefined;
let reloadConfig = () => {};
let canWatchFiles = false;
// Clients that pull diagnostics get them that way only, so they don't see each one twice.
let push = true;
let content: ReturnType<typeof contentServer> | undefined;

// mystmd couldn't start or stopped: tell the user, and carry on with open documents only.
const fail = (message: string) => {
  loading = false;
  content?.stop();
  progress?.done();
  connection.window.showWarningMessage(`MyST: ${message}. Project-wide features are off; see the server log.`);
};

connection.onInitialize(async (params) => {
  const folder = params.workspaceFolders?.[0]?.uri ?? params.rootUri;
  const workspace = params.capabilities.workspace;
  canWatchFiles = !!workspace?.didChangeWatchedFiles?.dynamicRegistration;
  push = !params.capabilities.textDocument?.diagnostic;
  const refresh = () => {
    if (loading && project.loaded) {
      loading = false;
      progress?.done();
    }
    if (push) [...documents.all(), ...cells.all()].forEach(({ uri }) => connection.sendDiagnostics({ uri, diagnostics: service.diagnostics(uri) }));
    if (workspace?.diagnostics?.refreshSupport) connection.languages.diagnostics.refresh();
    if (workspace?.inlayHint?.refreshSupport) connection.languages.inlayHint.refresh();
    if (workspace?.semanticTokens?.refreshSupport) connection.languages.semanticTokens.refresh();
  };
  // The project folder: --root, else see findProjectRoot.
  const workspaceFolder = folder ? fileURLToPath(folder) : undefined;
  const root = args.root ?? (workspaceFolder && (findProjectRoot(workspaceFolder) ?? workspaceFolder));
  // Unless told otherwise, the server runs mystmd itself when the project has a myst.yml, so clients needn't start it.
  let url = args['content-server'];
  if (!url && !args['no-myst'] && root && existsSync(join(root, 'myst.yml'))) {
    const myst = await startMyst(root);
    myst.exited.catch((e) => fail(e.message));
    url = myst.url;
  }
  loading = !!url;
  content = url ? contentServer(url) : undefined;
  const project = createProject(content, refresh);
  // External projects from myst.yml `project.references`, refreshed as their inventories load.
  const xrefs: Record<string, XrefProject> = {};
  const readXrefs = () => syncXrefs(xrefs, root ? readReferences(root) : {}, refresh);
  readXrefs();
  service = createService(root, project, xrefs);
  reloadConfig = () => (service.reloadConfig(), readXrefs(), refresh());
  return {
    capabilities: {
      textDocumentSync: TextDocumentSyncKind.Incremental,
      notebookDocumentSync: { notebookSelector: [{ notebook: { notebookType: 'jupyter-notebook' }, cells: [{ language: 'markdown' }] }] },
      completionProvider: { triggerCharacters: ['`', '#', '{', '(', '/', ':', '@'] },
      hoverProvider: true,
      definitionProvider: true,
      referencesProvider: true,
      renameProvider: { prepareProvider: true },
      inlayHintProvider: true,
      workspaceSymbolProvider: true,
      documentSymbolProvider: true,
      documentLinkProvider: {},
      semanticTokensProvider: { legend: semanticTokensLegend, full: true },
      // A file's diagnostics depend on the labels in other files.
      diagnosticProvider: { interFileDependencies: true, workspaceDiagnostics: true },
    },
  };
});

// Show "Loading project" while mystmd builds. Clients without progress support get a no-op reporter.
// There's no timeout: if the content server never answers, there's no project yet, so the progress stays up.
connection.onInitialized(async () => {
  // Re-read the bibliography and external references when they change, so edits don't need a restart.
  if (canWatchFiles) connection.client.register(DidChangeWatchedFilesNotification.type, { watchers: [{ globPattern: '**/*.bib' }, { globPattern: '**/myst.yml' }] });
  if (!loading) return;
  const p = await connection.window.createWorkDoneProgress();
  if (!loading) return; // loaded while we waited
  progress = p;
  p.begin('MyST', undefined, 'Loading project');
});

connection.onDidChangeWatchedFiles(() => reloadConfig());
connection.onCompletion((p) => service.completion(p));
connection.onHover((p) => service.hover(p));
connection.onDefinition((p) => service.definition(p));
connection.onReferences((p) => service.references(p));
connection.onPrepareRename((p) => service.prepareRename(p));
connection.onRenameRequest((p) => service.rename(p));
connection.languages.inlayHint.on((p) => service.inlayHints(p));
connection.languages.semanticTokens.on((p) => service.semanticTokens(p));
connection.onDocumentLinks((p) => service.documentLinks(p));
connection.onWorkspaceSymbol((p) => service.workspaceSymbols(p));
connection.onDocumentSymbol((p) => service.documentSymbols(p));
connection.languages.diagnostics.on((p) => ({ kind: 'full', items: service.diagnostics(p.textDocument.uri) }));
connection.languages.diagnostics.onWorkspace(() => service.workspaceDiagnostics());

// Diagnostics are sent when the project changes (after the service re-parses an edited document), not on every keystroke.
for (const docs of [documents, cells]) {
  docs.onDidChangeContent(({ document }) => service.update(document.uri, document.getText()));
  docs.onDidClose(({ document }) => {
    service.close(document.uri);
    if (push) connection.sendDiagnostics({ uri: document.uri, diagnostics: [] });
  });
}

// Node skips `exit` handlers on SIGTERM, which would leave the mystmd we started running.
process.on('SIGTERM', () => process.exit());

documents.listen(connection);
notebooks.listen(connection);
connection.listen();
