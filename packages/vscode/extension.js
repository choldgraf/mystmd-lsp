const { commands, window, workspace } = require('vscode');
const { LanguageClient, TransportKind } = require('vscode-languageclient/node');

let client;

// `mystmd.serverPath` runs your own install; otherwise run the server bundled in this extension, with VS Code's own Node.
const createClient = (context) => {
  const serverPath = workspace.getConfiguration('mystmd').get('serverPath');
  const server = serverPath ? { command: serverPath, args: ['--stdio'] } : { module: context.asAbsolutePath('dist/server.cjs'), transport: TransportKind.ipc };
  // Cells of a notebook are documents with the vscode-notebook-cell scheme.
  return new LanguageClient('mystmd', 'MyST', server, { documentSelector: [{ language: 'markdown' }] });
};

// The language server runs `myst start`, so it knows where the built site is.
const startPreview = async () => {
  const url = await commands.executeCommand('mystmd.siteUrl');
  if (!url) return window.showWarningMessage('The MyST preview needs mystmd installed and a myst.yml in your project folder.');
  return commands.executeCommand('simpleBrowser.show', url);
};

exports.activate = (context) => {
  client = createClient(context);
  context.subscriptions.push(
    commands.registerCommand('mystmd.restartServer', () => client.restart()),
    commands.registerCommand('mystmd.showLog', () => client.outputChannel.show()),
    commands.registerCommand('mystmd.startPreview', startPreview),
  );
  return client.start();
};

exports.deactivate = () => client?.stop();
