const { workspace } = require('vscode');
const { LanguageClient } = require('vscode-languageclient/node');

let client;

exports.activate = () => {
  const command = workspace.getConfiguration('mystmd').get('serverPath');
  client = new LanguageClient(
    'mystmd',
    'MyST',
    { command, args: ['--stdio'] },
    // Cells of a notebook are documents with the vscode-notebook-cell scheme.
    { documentSelector: [{ language: 'markdown' }] },
  );
  return client.start();
};

exports.deactivate = () => client?.stop();
