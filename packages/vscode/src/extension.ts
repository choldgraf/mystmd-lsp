import * as vscode from 'vscode';
import { LanguageClient, TransportKind } from 'vscode-languageclient/node';

let client: LanguageClient | undefined;

export async function activate(context: vscode.ExtensionContext) {
  const config = vscode.workspace.getConfiguration('mystmdLsp');
  const server = config.get<string>('serverPath') || context.asAbsolutePath('dist/server.cjs');
  client = new LanguageClient(
    'mystmdLsp',
    'MyST Language Server',
    { module: server, transport: TransportKind.ipc, args: config.get<boolean>('execute') ? ['--execute'] : [] },
    {
      // Notebook cells need their own entry so pull diagnostics cover them.
      documentSelector: [{ scheme: 'file', language: 'markdown' }, { notebook: { notebookType: 'jupyter-notebook' }, language: 'markdown' }],
    },
  );
  await client.start();
  // The extension's public API. MyST Author's extension reads it: the client for `myst/project`, and `server` to spawn for its own editors.
  return { client, server };
}

export function deactivate() {
  return client?.stop();
}
