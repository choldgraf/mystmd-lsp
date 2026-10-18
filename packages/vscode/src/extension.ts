import * as vscode from 'vscode';
import { LanguageClient, TransportKind } from 'vscode-languageclient/node';

let client: LanguageClient | undefined;

export async function activate(context: vscode.ExtensionContext) {
  const config = vscode.workspace.getConfiguration('mystmdLsp');
  const server = config.get<string>('serverPath') || context.asAbsolutePath('dist/server.cjs');
  // mystmd runs the project's plugins, so an untrusted workspace gets the server without it.
  const args = [...(config.get<boolean>('execute') ? ['--execute'] : []), ...(vscode.workspace.isTrusted ? [] : ['--no-myst'])];
  client = new LanguageClient(
    'mystmdLsp',
    'MyST Language Server',
    { module: server, transport: TransportKind.ipc, args },
    {
      // Notebook cells need their own entry so pull diagnostics cover them.
      documentSelector: [{ scheme: 'file', language: 'markdown' }, { notebook: { notebookType: 'jupyter-notebook' }, language: 'markdown' }],
    },
  );
  await client.start();

  // The status bar names the active document's project, and clicking it says why the document does or doesn't get features.
  const status = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left);
  status.command = 'mystmdLsp.showProject';
  let explanation = '';
  const update = async (editor = vscode.window.activeTextEditor) => {
    const document = editor?.document;
    if (document?.languageId !== 'markdown' || !['file', 'vscode-notebook-cell'].includes(document.uri.scheme)) return status.hide();
    const { uri } = document; // the server reads a notebook cell's URI as the notebook
    const { root, page } = await client!.sendRequest<{ root?: string; page?: boolean }>('myst/project', { uri: uri.toString() });
    if (vscode.window.activeTextEditor !== editor) return; // switched again while we waited
    const basename = (p: string) => p.split(/[\\/]/).pop();
    const file = basename(uri.path);
    const name = root && basename(root);
    if (!root) {
      status.text = 'MyST: no project';
      explanation = 'No myst.yml between this file and its workspace folder. Run `myst init` in the folder to make a project.';
    } else if (page) {
      status.text = `MyST: ${name}`;
      explanation = `${file} is a page of the MyST project at ${root}.`;
    } else {
      status.text = `MyST: not a page of ${name}`;
      explanation = `${root} has a myst.yml, but mystmd doesn't build ${file}. The project's toc or exclude may leave it out, or it's in _build or a hidden folder.`;
    }
    status.show();
  };
  context.subscriptions.push(
    status,
    vscode.window.onDidChangeActiveTextEditor(update),
    vscode.commands.registerCommand('mystmdLsp.showProject', () => vscode.window.showInformationMessage(explanation)),
    vscode.workspace.onDidGrantWorkspaceTrust(() => vscode.window.showInformationMessage('MyST: reload the window to start mystmd for project-wide features.')),
  );
  update();

  // The extension's public API, read by MyST Author's extension.
  // It sends `myst/project` through `client`, and spawns `server` for its own editors.
  return { client, server };
}

export function deactivate() {
  return client?.stop();
}
