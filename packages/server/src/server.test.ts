import { test, type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { tmpWorkspace } from './test-helpers.ts';
import { CompletionItemKind, createProtocolConnection, StreamMessageReader, StreamMessageWriter, type ProtocolConnection } from 'vscode-languageserver/node';

// The bundle users run, which `npm test` builds first.
const server = new URL('../dist/server.cjs', import.meta.url).pathname;

/** Start the bundle on a temp workspace holding `files`, and initialize it. */
async function startServer(t: TestContext, files: Record<string, string>) {
  const root = tmpWorkspace(t, files);
  const child = spawn(process.execPath, [server, '--stdio']);
  const conn = createProtocolConnection(new StreamMessageReader(child.stdout), new StreamMessageWriter(child.stdin));
  t.after(() => (conn.dispose(), child.kill()));
  conn.listen();
  await conn.sendRequest('initialize', { processId: null, rootUri: pathToFileURL(root).href, capabilities: {} });
  conn.sendNotification('initialized', {});
  return { root, child, conn };
}

/** Poll workspace symbols until mystmd's first build is indexed. */
async function waitForBuild(conn: ProtocolConnection) {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline && ((await conn.sendRequest('workspace/symbol', { query: '' })) as any[]).length === 0) await new Promise((r) => setTimeout(r, 500));
  assert.ok(Date.now() < deadline, 'mystmd did not finish a build in 30s');
}

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
  const { root, conn } = await startServer(t, { 'a.png': '' });
  const uri = pathToFileURL(join(root, 'index.md')).href;
  const diagnostics = new Promise<any>((resolve) => conn.onNotification('textDocument/publishDiagnostics', resolve));
  conn.sendNotification('textDocument/didOpen', { textDocument: { uri, languageId: 'markdown', version: 1, text } });

  // Without a content server, unknown targets aren't flagged (they may live in files that aren't open).
  const pushed = await diagnostics;
  const [xref, ...rest] = pushed.diagnostics;
  assert.match(xref.message, /Unknown external project `nope`/);
  assert.deepEqual(rest, []);
  // Clients that pull diagnostics get the same ones.
  assert.deepEqual(await conn.sendRequest('textDocument/diagnostic', { textDocument: { uri } }), { kind: 'full', items: pushed.diagnostics });

  const items: any[] = await conn.sendRequest('textDocument/completion', { textDocument: { uri }, position: { line: 10, character: 9 } });
  assert.deepEqual(items.map((i) => [i.label, i.detail, i.labelDetails.description, i.kind]), [['fig-logo', 'Figure 1 · index.md', 'Figure 1', CompletionItemKind.Color]]);

  const hints: any[] = await conn.sendRequest('textDocument/inlayHint', { textDocument: { uri }, range: { start: { line: 0, character: 0 }, end: { line: 11, character: 0 } } });
  assert.deepEqual(hints.map((h) => h.label), ['Figure 1']);

  // No myst.yml, so no content server.
  assert.deepEqual(await conn.sendRequest('myst/project', {}), { root });
});

// Needs a working mystmd, so `npm run test:mystmd` asks for these.
const mystmd = { skip: !process.env.TEST_MYSTMD, timeout: 90_000 };
const mystProject = {
  'myst.yml': 'version: 1\nproject:\n  id: test\nsite:\n  template: book-theme\n',
  'index.md': '# Title\n\n(sec-a)=\n## Section\n',
};

test('with real mystmd: the project loads, and the user is warned when mystmd dies', mystmd, async (t) => {
  const { child, conn } = await startServer(t, mystProject);
  const warning = new Promise<any>((resolve) => conn.onRequest('window/showMessageRequest', resolve));
  await waitForBuild(conn);
  assert.match(((await conn.sendRequest('myst/project', {})) as any).contentServer, /^http:\/\/127\.0\.0\.1:\d+$/);

  spawnSync('pkill', ['-P', String(child.pid)]); // mystmd is the server's only child
  assert.match((await warning).message, /myst exited/);
});

test('with real mystmd: stopping the server with SIGTERM stops its mystmd', mystmd, async (t) => {
  const { child, conn } = await startServer(t, mystProject);
  // mystmd outlives its parent once it's built and idle, so wait for the first build.
  await waitForBuild(conn);

  const myst = Number(spawnSync('pgrep', ['-P', String(child.pid)]).stdout.toString().trim());
  assert.ok(myst, 'the server started mystmd');
  child.kill('SIGTERM');
  await new Promise((r) => child.on('exit', r));
  await new Promise((r) => setTimeout(r, 500));
  assert.throws(() => process.kill(myst, 0), 'mystmd stopped');
});
