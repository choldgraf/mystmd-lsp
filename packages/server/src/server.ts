#!/usr/bin/env node
import { existsSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { createConnection, DidChangeWatchedFilesNotification, NotebookDocuments, ProposedFeatures, TextDocuments, TextDocumentSyncKind, type ClientCapabilities, type WorkDoneProgressServerReporter } from 'vscode-languageserver/node';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { contentServer } from 'mystmd-client/content-server';
import { startMyst } from 'mystmd-client/start';
import { createProject } from './project.ts';
import { findProjectRoot } from './root.ts';
import { createService, pathOf, semanticTokensLegend } from './service.ts';
import { readReferences, syncXrefs, type XrefProject } from './xref.ts';

const args = parseArgs({ strict: false, options: { 'content-server': { type: 'string' }, root: { type: 'string' }, 'no-myst': { type: 'boolean' }, execute: { type: 'boolean' }, help: { type: 'boolean', short: 'h' } } }).values as { 'content-server'?: string; root?: string; 'no-myst'?: boolean; execute?: boolean; help?: boolean };
if (args.help) {
  console.log('Usage: mystmd-lsp --stdio [--root=path/to/project] [--content-server=URL] [--no-myst] [--execute]\nSee https://chrisholdgraf.com/mystmd-lsp/configuration');
  process.exit(0);
}
if (args.root) args.root = resolve(args.root); // compared with document paths

// The LSP wiring: features live in service.ts.
const connection = createConnection(ProposedFeatures.all);
const documents = new TextDocuments(TextDocument);
// Notebooks from clients with notebook sync (VS Code): each Markdown cell is a document.
const notebooks = new NotebookDocuments(TextDocument);
const cells = notebooks.cellTextDocuments;
let workspace: ClientCapabilities['workspace'];
let canWatchFiles = false;
// Diagnostics are pushed until the client pulls them, so it doesn't see each one twice.
// Waiting for a pull, not trusting the capability, is for @codemirror/lsp-client, which advertises pull diagnostics but never pulls.
let push = true;
// The workspace folders: a document's project is the nearest myst.yml at or above it, no higher than these.
let ceilings: string[] = [];

type Service = ReturnType<typeof createService>;
// A project: its mystmd (`url` is the content server), index and service. `loading` is true until mystmd's first build is indexed.
type Entry = { service: Service; url?: string; loading: boolean; progress?: WorkDoneProgressServerReporter; reloadConfig: () => void };
// Projects by root, started when the first document in them opens. The promise is stored so two documents opening at once share one mystmd.
const entries = new Map<string, Promise<Entry>>();

// A document's project folder: --root for everything, else see findProjectRoot. Undefined outside every workspace folder.
const rootFor = (uri: string) => args.root ?? findProjectRoot(dirname(pathOf(uri)), ceilings);

function entryFor(root: string) {
  let entry = entries.get(root);
  if (!entry) entries.set(root, (entry = createEntry(root)));
  return entry;
}

async function createEntry(root: string): Promise<Entry> {
  // mystmd couldn't start or stopped: tell the user, and carry on with open documents only.
  // Like `refresh`, this runs only after `project` and `entry` below exist.
  const fail = (message: string) => {
    entry.loading = false;
    project.unwatch();
    entry.progress?.done();
    connection.window.showWarningMessage(`MyST: ${message}. Project-wide features are off; see the server log.`);
  };
  // Unless told otherwise, the server runs mystmd itself when the project has a myst.yml, so clients needn't start it.
  // --content-server is the --root project's mystmd, started by the client.
  let url = args.root ? args['content-server'] : undefined;
  let notStarted: string | undefined;
  if (!url && !args['no-myst'] && existsSync(join(root, 'myst.yml'))) {
    const myst = await startMyst(root, undefined, args.execute ? ['--execute'] : undefined).catch((e) => void (notStarted = e.message));
    myst?.exited.catch((e) => fail(e.message));
    url = myst?.url;
  }
  const refresh = () => {
    if (entry.loading && project.loaded) {
      entry.loading = false;
      entry.progress?.done();
      // mystmd has now loaded the plugins (and cached remote ones), so their specs can be read.
      service.loadPlugins();
    }
    // A document that stopped being a page after a rebuild gets its diagnostics cleared.
    if (push) for (const { uri } of [...documents.all(), ...cells.all()]) if (rootFor(uri) === root) connection.sendDiagnostics({ uri, diagnostics: service.isPage(uri) ? service.diagnostics(uri) : [] });
    if (workspace?.diagnostics?.refreshSupport) connection.languages.diagnostics.refresh();
    if (workspace?.inlayHint?.refreshSupport) connection.languages.inlayHint.refresh();
    if (workspace?.semanticTokens?.refreshSupport) connection.languages.semanticTokens.refresh();
  };
  const project = createProject(url ? contentServer(url) : undefined, refresh);
  // External projects from myst.yml `project.references`, refreshed as their inventories load.
  const xrefs: Record<string, XrefProject> = {};
  const readXrefs = () => syncXrefs(xrefs, readReferences(root), refresh);
  const service = createService(root, project, xrefs);
  // Plugins load only when mystmd runs (`url`), so `--no-myst` never imports their code.
  const entry: Entry = { service, url, loading: !!url, reloadConfig: () => (service.reloadConfig(), url && service.loadPlugins(), readXrefs(), refresh()) };
  readXrefs();
  if (notStarted) fail(notStarted);
  // Show "Loading <folder>" while mystmd builds. Clients without progress support get a no-op reporter.
  // There's no timeout: if the content server never answers, there's no project yet, so the progress stays up.
  if (entry.loading) connection.window.createWorkDoneProgress().then((p) => {
    if (!entry.loading) return; // loaded while we waited
    entry.progress = p;
    p.begin('MyST', undefined, `Loading ${basename(root)}`);
  });
  return entry;
}

// A document's service, when it's a page of its project. Otherwise it gets no features.
async function serviceFor(uri: string) {
  const root = rootFor(uri);
  const entry = root ? await entryFor(root) : undefined;
  return entry?.service.isPage(uri) ? entry.service : undefined;
}
// A document request answered by its service, or with nothing.
const onDocument = <P extends { textDocument: { uri: string } }, R>(handle: (service: Service, params: P) => R) => async (params: P) => {
  const service = await serviceFor(params.textDocument.uri);
  return service ? handle(service, params) : null;
};
const all = () => Promise.all(entries.values());

connection.onInitialize((params) => {
  // resolve() drops a trailing slash, so a folder compares equal to the dirname() of its files.
  ceilings = (params.workspaceFolders?.map((f) => f.uri) ?? (params.rootUri ? [params.rootUri] : [])).map((uri) => resolve(fileURLToPath(uri)));
  workspace = params.capabilities.workspace;
  canWatchFiles = !!workspace?.didChangeWatchedFiles?.dynamicRegistration;
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
      // Any file or folder, since Markdown links to images and code too.
      workspace: { fileOperations: { willRename: { filters: [{ scheme: 'file', pattern: { glob: '**/*' } }] } } },
    },
  };
});

connection.onInitialized(() => {
  // Re-read the bibliography and external references when they change, so edits don't need a restart.
  if (canWatchFiles) connection.client.register(DidChangeWatchedFilesNotification.type, { watchers: [{ globPattern: '**/*.bib' }, { globPattern: '**/myst.yml' }] });
});

// Where a document's project is, for clients that build on this server (MyST Author's preview uses the same mystmd).
// Without `uri`, the --root project.
connection.onRequest('myst/project', async (params: { uri?: string } | null): Promise<{ root?: string; contentServer?: string; page?: boolean }> => {
  const uri = params?.uri;
  const root = uri ? rootFor(uri) : args.root;
  if (!root) return {};
  const entry = await entryFor(root);
  return { root, contentServer: entry.url, page: uri ? entry.service.isPage(uri) : undefined };
});

connection.onDidChangeWatchedFiles(async () => (await all()).forEach((e) => e.reloadConfig()));
connection.onCompletion(onDocument((s, p) => s.completion(p)));
connection.onHover(onDocument((s, p) => s.hover(p)));
connection.onDefinition(onDocument((s, p) => s.definition(p)));
connection.onReferences(onDocument((s, p) => s.references(p)));
connection.onPrepareRename(onDocument((s, p) => s.prepareRename(p)));
connection.onRenameRequest(onDocument((s, p) => s.rename(p)));
connection.workspace.onWillRenameFiles(async (p) => ({ changes: Object.assign({}, ...(await all()).map((e) => e.service.willRenameFiles(p).changes)) }));
connection.languages.inlayHint.on(onDocument((s, p) => s.inlayHints(p)));
connection.languages.semanticTokens.on(onDocument((s, p) => s.semanticTokens(p)));
connection.onDocumentLinks(onDocument((s, p) => s.documentLinks(p)));
// Across projects, exact matches still come first, since clients find a label's definition with this (see features.md).
connection.onWorkspaceSymbol(async ({ query }) => {
  const exact = (name: string) => Number(name.toLowerCase() === query.toLowerCase());
  return (await all()).flatMap((e) => e.service.workspaceSymbols({ query })).sort((a, b) => exact(b.name) - exact(a.name));
});
connection.onDocumentSymbol(onDocument((s, p) => s.documentSymbols(p)));
// The first pull stops the pushes, and clears what was pushed before it.
const pulled = () => {
  if (push) for (const { uri } of [...documents.all(), ...cells.all()]) connection.sendDiagnostics({ uri, diagnostics: [] });
  push = false;
};
connection.languages.diagnostics.on(async (p) => {
  pulled();
  return { kind: 'full', items: (await serviceFor(p.textDocument.uri))?.diagnostics(p.textDocument.uri) ?? [] };
});
connection.languages.diagnostics.onWorkspace(async () => {
  pulled();
  return { items: (await all()).flatMap((e) => e.service.workspaceDiagnostics().items) };
});

// Diagnostics are sent when the project changes (after the service re-parses an edited document), not on every keystroke.
// Every document in a project is kept, page or not, so one that becomes a page after a rebuild has its text.
for (const docs of [documents, cells]) {
  docs.onDidChangeContent(async ({ document }) => {
    const root = rootFor(document.uri);
    if (root) (await entryFor(root)).service.update(document.uri, document.getText());
  });
  docs.onDidClose(async ({ document }) => {
    const root = rootFor(document.uri);
    if (root) (await entryFor(root)).service.close(document.uri);
    if (push) connection.sendDiagnostics({ uri: document.uri, diagnostics: [] });
  });
}

// Node skips `exit` handlers on SIGTERM, which would leave the mystmd we started running.
process.on('SIGTERM', () => process.exit());

documents.listen(connection);
notebooks.listen(connection);
connection.listen();
