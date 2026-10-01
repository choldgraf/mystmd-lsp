import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { CompletionItemKind, createProtocolConnection, StreamMessageReader, StreamMessageWriter } from 'vscode-languageserver/node';

const text = `(fig-a)=
# Heading

\`\`\`{figure} a.png
:label: fig-logo

A logo.
\`\`\`

See {numref}\`fig-logo\` and {ref}\`missing\`.
{numref}\`
[x](
[](xref:nope#x)
`;

test('server completes, hints and diagnoses over stdio', async (t) => {
  const root = mkdtempSync(join(tmpdir(), 'lsp-'));
  writeFileSync(join(root, 'other.md'), '# Other\n');
  writeFileSync(join(root, 'a.png'), '');
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

  const files: any[] = await conn.sendRequest('textDocument/completion', { textDocument: { uri }, position: { line: 11, character: 4 } });
  assert.deepEqual(files.map((i) => i.label), ['other.md']);

  const symbols: any[] = await conn.sendRequest('workspace/symbol', { query: 'fig-logo' });
  assert.deepEqual(symbols.map((s) => [s.name, s.location.range.start.line]), [['fig-logo', 3]]);

  const uri2 = pathToFileURL(join(root, 'options.md')).href;
  conn.sendNotification('textDocument/didOpen', { textDocument: { uri: uri2, languageId: 'markdown', version: 1, text: '```{figure} a.png\n:name: x\n:\n```\n' } });
  const options: any[] = await conn.sendRequest('textDocument/completion', { textDocument: { uri: uri2 }, position: { line: 2, character: 1 } });
  const labels = options.map((i) => i.label);
  assert.ok(labels.includes('width') && !labels.includes('label'), 'offers figure options, minus `label` (set via its alias `name`)');
  assert.equal(options.find((i) => i.label === 'width').textEdit.newText, 'width: ');
});

const hasMyst = spawnSync('myst', ['--version']).status === 0;

test('with real mystmd: the project loads, and the user is warned when mystmd dies', { skip: !hasMyst, timeout: 90_000 }, async (t) => {
  const root = mkdtempSync(join(tmpdir(), 'lsp-'));
  writeFileSync(join(root, 'myst.yml'), 'version: 1\nproject:\n  id: test\nsite:\n  template: book-theme\n');
  writeFileSync(join(root, 'index.md'), '# Title\n\n(sec-a)=\n## Section\n');

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
