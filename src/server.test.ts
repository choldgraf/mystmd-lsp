import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { tmpWorkspace } from './test-helpers.ts';
import { CompletionItemKind, createProtocolConnection, StreamMessageReader, StreamMessageWriter } from 'vscode-languageserver/node';

const text = `(fig-a)=
# Heading

\`\`\`{figure} a.png
:label: fig-logo

A logo.
\`\`\`

See {numref}\`fig-logo\` and {ref}\`missing\`.
{numref}\`
[](xref:nope#x)
`;

// Each feature is tested through `createService` in service.test.ts; this checks that the server wires a few of them to LSP requests.
test('server completes, hints and diagnoses over stdio', async (t) => {
  const root = tmpWorkspace(t, { 'a.png': '' });
  const uri = pathToFileURL(join(root, 'index.md')).href;

  const child = spawn(process.execPath, [new URL('server.ts', import.meta.url).pathname, '--stdio']);
  const conn = createProtocolConnection(new StreamMessageReader(child.stdout), new StreamMessageWriter(child.stdin));
  t.after(() => (conn.dispose(), child.kill()));
  const diagnostics = new Promise<any>((resolve) => conn.onNotification('textDocument/publishDiagnostics', resolve));
  conn.listen();

  await conn.sendRequest('initialize', { processId: null, rootUri: pathToFileURL(root).href, capabilities: {} });
  conn.sendNotification('initialized', {});
  conn.sendNotification('textDocument/didOpen', { textDocument: { uri, languageId: 'markdown', version: 1, text } });

  // Without a content server, unknown targets aren't flagged (they may live in files that aren't open).
  const { diagnostics: [xref, ...rest] } = await diagnostics;
  assert.match(xref.message, /Unknown external project `nope`/);
  assert.deepEqual(rest, []);

  const items: any[] = await conn.sendRequest('textDocument/completion', { textDocument: { uri }, position: { line: 10, character: 9 } });
  assert.deepEqual(items.map((i) => [i.label, i.detail, i.labelDetails.description, i.kind]), [['fig-logo', 'Figure 1 · index.md', 'Figure 1', CompletionItemKind.Color]]);

  const hints: any[] = await conn.sendRequest('textDocument/inlayHint', { textDocument: { uri }, range: { start: { line: 0, character: 0 }, end: { line: 11, character: 0 } } });
  assert.deepEqual(hints.map((h) => h.label), ['Figure 1']);
});

const hasMyst = spawnSync('myst', ['--version']).status === 0;

test('with real mystmd: the project loads, and the user is warned when mystmd dies', { skip: !hasMyst, timeout: 90_000 }, async (t) => {
  const root = tmpWorkspace(t, {
    'myst.yml': 'version: 1\nproject:\n  id: test\nsite:\n  template: book-theme\n',
    'index.md': '# Title\n\n(sec-a)=\n## Section\n',
  });

  const child = spawn(process.execPath, [new URL('server.ts', import.meta.url).pathname, '--stdio']);
  const conn = createProtocolConnection(new StreamMessageReader(child.stdout), new StreamMessageWriter(child.stdin));
  t.after(() => (conn.dispose(), child.kill()));
  const warning = new Promise<any>((resolve) => conn.onRequest('window/showMessageRequest', resolve));
  conn.listen();
  await conn.sendRequest('initialize', { processId: null, rootUri: pathToFileURL(root).href, capabilities: {} });
  conn.sendNotification('initialized', {});

  // Wait for mystmd's first build to be indexed.
  for (let found = false; !found; await new Promise((r) => setTimeout(r, 500))) {
    found = ((await conn.sendRequest('workspace/symbol', { query: '' })) as any[]).length > 0;
  }

  spawnSync('pkill', ['-P', String(child.pid)]); // mystmd is the server's only child
  assert.match((await warning).message, /myst exited/);
});

test('with real mystmd: stopping the server with SIGTERM stops its mystmd', { skip: !hasMyst, timeout: 90_000 }, async (t) => {
  const root = tmpWorkspace(t, {
    'myst.yml': 'version: 1\nproject:\n  id: test\nsite:\n  template: book-theme\n',
    'index.md': '# Title\n\n(sec-a)=\n## Section\n',
  });
  const child = spawn(process.execPath, [new URL('server.ts', import.meta.url).pathname, '--stdio']);
  const conn = createProtocolConnection(new StreamMessageReader(child.stdout), new StreamMessageWriter(child.stdin));
  t.after(() => (conn.dispose(), child.kill()));
  conn.listen();
  await conn.sendRequest('initialize', { processId: null, rootUri: pathToFileURL(root).href, capabilities: {} });
  conn.sendNotification('initialized', {});
  // mystmd outlives its parent once it's built and idle, so wait for the first build.
  for (let found = false; !found; await new Promise((r) => setTimeout(r, 500))) {
    found = ((await conn.sendRequest('workspace/symbol', { query: '' })) as any[]).length > 0;
  }

  const myst = Number(spawnSync('pgrep', ['-P', String(child.pid)]).stdout.toString().trim());
  assert.ok(myst, 'the server started mystmd');
  child.kill('SIGTERM');
  await new Promise((r) => child.on('exit', r));
  await new Promise((r) => setTimeout(r, 500));
  assert.throws(() => process.kill(myst, 0), 'mystmd stopped');
});
