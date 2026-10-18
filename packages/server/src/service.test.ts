import { test, type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { CompletionItemKind, DiagnosticSeverity } from 'vscode-languageserver';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { parseMyst } from 'mystmd-client/parse';
import { createProject } from './project.ts';
import { createService, semanticTokensLegend } from './service.ts';
import { marks, stubProject, tmpWorkspace } from './test-helpers.ts';

const root = '/book';
const uri = 'file:///book/index.md';
const text = 'See {numref}`Fig-Built` and {ref}`missing`.\n{ref}`notes`\n';
const built = { identifier: 'fig-built', kind: 'figure', text: 'A plot', enumerator: '2', file: 'chapter/plots.md', line: 5 };
const outside = { identifier: 'notes', kind: 'heading', text: 'Notes', file: '/elsewhere/notes.md', line: 1 };

const stub = () => stubProject([built, outside]);
const mod = (kind: string) => 1 << semanticTokensLegend.tokenModifiers.indexOf(kind);

test('a loaded project resolves built targets and flags unknown ones', () => {
  const service = createService(root, stub());
  service.update(uri, text);

  assert.deepEqual(service.diagnostics(uri).map((d) => d.message), ['Unknown reference target `missing`']);
  assert.deepEqual(service.inlayHints({ textDocument: { uri } }).map((h) => h.label), ['Figure 2', 'Section: Notes']);
  assert.deepEqual(service.definition({ textDocument: { uri }, position: { line: 0, character: 15 } }), {
    uri: 'file:///book/chapter/plots.md',
    range: { start: { line: 4, character: 0 }, end: { line: 4, character: 0 } },
  });
  // Open files outside the workspace keep absolute paths.
  assert.equal(service.definition({ textDocument: { uri }, position: { line: 1, character: 7 } })?.uri, 'file:///elsewhere/notes.md');
});

test('`{term}` completes, resolves and flags glossary terms', () => {
  const term = { identifier: 'term-myst markdown', kind: 'term', text: 'MyST Markdown', doc: 'A markup language.', file: 'glossary.md', line: 3 };
  const service = createService(root, stubProject([term]));
  const { text, at } = marks('{term}`MyST| markdown` and {term}`markup <MyST Markdown>`, {term}`nope`.\n{term}`|');
  service.update(uri, text);
  assert.deepEqual(service.diagnostics(uri).map((d) => d.message), ['Unknown glossary term `nope`']);
  assert.deepEqual(service.inlayHints({ textDocument: { uri } }), []);
  assert.equal((service.hover({ textDocument: { uri }, position: at[0] }) as any).contents.value, '**Term** · glossary.md\n\nA markup language.');
  assert.deepEqual((service.completion({ textDocument: { uri }, position: at[1] }) as any[]).map((i) => i.textEdit.newText), ['MyST Markdown`']);
});

test('labels match by text', () => {
  const service = createService(root, stub());
  assert.deepEqual(service.workspaceSymbols({ query: 'plot' }).map((s) => s.name), ['fig-built']);
});

test('the outline nests sections by level, with numbered blocks under their section', () => {
  const at = (identifier: string, line: number, extra: { kind: string; depth?: number; enumerator?: string }) => ({ identifier, text: identifier, file: 'index.md', line, ...extra });
  const targets = [
    at('intro', 1, { kind: 'heading', depth: 1 }),
    at('methods', 3, { kind: 'heading', depth: 2 }),
    at('fig-a', 5, { kind: 'figure', enumerator: '1' }),
    at('results', 7, { kind: 'heading', depth: 2 }),
  ];
  const service = createService(root, stubProject(targets));
  service.update(uri, '# intro\n\n## methods\n\n:::{figure}\n:::\n## results\nlast line');
  const tree = (symbols: any[]): any[] => symbols.map((s) => [s.name, s.range.end.line, ...tree(s.children)]);
  assert.deepEqual(tree(service.documentSymbols({ textDocument: { uri } })), [['intro', 7, ['methods', 5, ['Figure 1 · fig-a', 4]], ['results', 7]]]);
});

test('references are label tokens with their target kind as a modifier', () => {
  const service = createService(root, stub());
  service.update(uri, text);
  // Delta-encoded [line, start, length, type, modifiers]: `Fig-Built` (a figure), `missing` (unknown), `notes` (a heading).
  assert.deepEqual(service.semanticTokens({ textDocument: { uri } }).data, [0, 13, 9, 0, mod('figure'), 0, 21, 7, 0, 0, 1, 6, 5, 0, mod('heading')]);
});

test('edits reach the project once typing stops, as project-relative files', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const project = stub();
  const service = createService(root, project);
  service.update(uri, 'a');
  service.update(uri, 'ab');
  service.update('file:///elsewhere/notes.md', 'c');
  assert.deepEqual(project.opened, []);
  t.mock.timers.tick(150);
  assert.deepEqual(project.opened, ['index.md', '/elsewhere/notes.md']);
});

test('`@key` and `{cite}` resolve to citations first, then labels', (t) => {
  const dir = tmpWorkspace(t, { 'refs.bib': '@article{nelson1977,\n  author = {Nelson, Ted and Smith, J.},\n  title = {{Computer} Lib},\n  year = 1977\n}\n' });
  const service = createService(dir, stub());
  const doc = pathToFileURL(join(dir, 'index.md')).href;
  const { text, at } = marks('See @fig-built and [@nel|son1977], {cite}`nelson1977, nope`.\n@|');
  service.update(doc, text);
  assert.deepEqual(service.inlayHints({ textDocument: { uri: doc } }).map((h) => h.label), ['Figure 2']);
  assert.deepEqual(service.definition({ textDocument: { uri: doc }, position: at[0] }), {
    uri: pathToFileURL(join(dir, 'refs.bib')).href,
    range: { start: { line: 0, character: 0 }, end: { line: 0, character: 0 } },
  });
  assert.deepEqual(service.diagnostics(doc).map((d) => d.message), ['Unknown citation or reference target `nope`']);
  const items = service.completion({ textDocument: { uri: doc }, position: at[1] }) as any[];
  assert.deepEqual(items.map((i) => [i.label, i.detail]).slice(0, 2), [['nelson1977', 'Nelson et al. 1977 · Computer Lib'], ['fig-built', 'Figure 2 · chapter/plots.md']]);
});

test('a key that is both a citation and a label is a citation to `@`, and a label to `{ref}`', (t) => {
  const dir = tmpWorkspace(t, { 'refs.bib': '@misc{fig-built,\n  title = {Shadow}\n}\n' });
  const service = createService(dir, stub());
  const doc = pathToFileURL(join(dir, 'index.md')).href;
  service.update(doc, '@fig-built {ref}`fig-built`\n');
  const at = (character: number) => ({ textDocument: { uri: doc }, position: { line: 0, character } });
  assert.match(service.hover(at(3))!.contents.value, /^\*\*fig-built\*\* · refs\.bib\n\nShadow/);
  assert.deepEqual(service.semanticTokens({ textDocument: { uri: doc } }).data, [0, 1, 9, 0, mod('citation'), 0, 16, 9, 0, mod('figure')]);
  assert.deepEqual(service.inlayHints({ textDocument: { uri: doc } }).map((h) => h.label), ['Figure 2']);
  // Find references from the label skips the citation.
  assert.deepEqual(service.references({ ...at(20), context: { includeDeclaration: false } })?.map((l) => l.range.start.character), [17]);
});

test('xrefs resolve against loaded inventories, and only loaded ones are checked', () => {
  const entry = { name: 'intro', kind: 'heading', title: 'Introduction', url: 'https://docs.example.org/guide#intro', page: '/guide' };
  const xrefs = { docs: { url: 'https://docs.example.org', kind: 'myst' as const, entries: [entry] }, offline: { url: 'https://offline.example.org' } };
  const service = createService(root, stub(), xrefs);
  const { text, at } = marks('[](xref:d|ocs/guide#intro) [](xref:docs/guide#nope) [](xref:nokey#x) [](xref:offline#x)\n');
  service.update(uri, text);
  assert.match(service.hover({ textDocument: { uri }, position: at[0] })!.contents.value, /^\*\*Introduction\*\* · heading\n\nhttps:\/\/docs\.example\.org\/guide#intro/);
  assert.deepEqual(service.documentLinks({ textDocument: { uri } }).map((l) => l.target), [entry.url]);
  assert.deepEqual(service.inlayHints({ textDocument: { uri } }).map((h) => h.label), ['Introduction']);
  assert.deepEqual(service.diagnostics(uri).map((d) => d.message), [
    '`docs/guide#nope` not found in docs (https://docs.example.org)',
    'Unknown external project `nokey` (add it to `project.references` in myst.yml)',
  ]);
});

test('external completion shows each target\'s kind, from MyST sites and Sphinx inventories', () => {
  const xrefs = {
    docs: { url: 'https://docs.example.org', kind: 'myst' as const, entries: [{ name: 'fig-a', kind: 'figure', title: 'A plot', url: 'https://docs.example.org/guide#fig-a', page: '/guide' }] },
    py: { url: 'https://py.example.org', kind: 'sphinx' as const, entries: [{ name: 'os.join', kind: 'py:function', title: 'os.join', url: 'https://py.example.org/os#os.join' }] },
  };
  const service = createService(root, stub(), xrefs);
  const { text, at } = marks('[](xref:docs#|) [](xref:py#|)\n');
  service.update(uri, text);
  const items = at.map((position) => (service.completion({ textDocument: { uri }, position }) as any).items[0]);
  assert.deepEqual(items.map((i) => [i.label, i.kind, i.labelDetails.description]), [
    ['fig-a', CompletionItemKind.Color, 'figure'],
    ['os.join', CompletionItemKind.Function, 'py:function'],
  ]);
});

// A workspace on disk: `a.md` defines the labels, `b.md` (also open, with unsaved edits), `c.md` and a Markdown cell of `nb.ipynb` reference them.
function labelWorkspace(t: TestContext) {
  const a = '(sec)=\n# Section\n\n:::{figure} x.png\n:label: Fig-One\n\nThe caption\n:::\n';
  const nb = { cells: [{ cell_type: 'code', id: 'code', source: 'See {numref}`fig-one`.' }, { cell_type: 'markdown', id: 'md', source: ['# Notes\n', 'See {numref}`fig-one`.'] }] };
  const dir = tmpWorkspace(t, { 'a.md': a, 'b.md': 'See {ref}`sec`.\n', 'c.md': 'See <#fig-one>.\n', 'nb.ipynb': JSON.stringify(nb) });
  // The built figure reports its caption's line, not the `:label:` line.
  const targets = [
    { identifier: 'sec', kind: 'heading', text: 'Section', file: 'a.md', line: 2 },
    { identifier: 'fig-one', kind: 'figure', text: 'The caption', enumerator: '1', file: 'a.md', line: 7 },
  ];
  const service = createService(dir, stubProject(targets));
  const uri = (f: string) => pathToFileURL(join(dir, f)).href;
  service.update(uri('a.md'), a);
  service.update(uri('b.md'), 'See @FIG-ONE and {numref}`fig-one`.\n');
  const spans = (locs: { uri: string; range: { start: { line: number; character: number } } }[]) =>
    locs.map((l) => `${l.uri.split('/').at(-1)}:${l.range.start.line}:${l.range.start.character}`).sort();
  return { service, uri, spans };
}

test('find references from a reference, across files and notebook cells, preferring unsaved text', (t) => {
  const { service, uri, spans } = labelWorkspace(t);
  const at = { textDocument: { uri: uri('b.md') }, position: { line: 0, character: 6 }, context: { includeDeclaration: true } };
  const refs = service.references(at)!;
  assert.deepEqual(spans(refs), ['a.md:4:8', 'b.md:0:26', 'b.md:0:5', 'c.md:0:6', 'nb.ipynb#md:1:13']);
  // A Markdown cell on disk is at its cell URI, with a range in the cell's source. The code cell isn't searched.
  assert.deepEqual(refs.find((l) => l.uri.endsWith('#md')), { uri: `${uri('nb.ipynb')}#md`, range: { start: { line: 1, character: 13 }, end: { line: 1, character: 20 } } });
  // Once the notebook is open, its open cells replace the file on disk.
  service.update(`${uri('nb.ipynb')}#md`, '{numref}`fig-one`');
  assert.deepEqual(spans(service.references(at)!), ['a.md:4:8', 'b.md:0:26', 'b.md:0:5', 'c.md:0:6', 'nb.ipynb#md:0:9']);
});

test('workspace diagnostics cover files and notebook cells on disk, and open documents\' unsaved text', (t) => {
  const nb = { cells: [{ cell_type: 'markdown', id: 'md', source: '{ref}`in-cell`' }] };
  const dir = tmpWorkspace(t, { 'a.md': '{ref}`on-disk`\n', 'b.md': '{ref}`saved`\n', 'nb.ipynb': JSON.stringify(nb) });
  // A label built from the notebook isn't flagged as a duplicate in each of its cells.
  const service = createService(dir, stubProject([built, { ...built, file: 'nb.ipynb' }]));
  service.update(pathToFileURL(join(dir, 'b.md')).href, '{ref}`unsaved`\n');
  const { items } = service.workspaceDiagnostics();
  assert.deepEqual(items.map((r) => [r.uri.split('/').at(-1), r.items.map((d) => d.message)]), [
    ['a.md', ['Unknown reference target `on-disk`']],
    ['nb.ipynb#md', ['Unknown reference target `in-cell`']],
    ['b.md', ['Unknown reference target `unsaved`']],
  ]);
});

test('rename a label from its definition, and not citations or unknown labels', (t) => {
  const { service, uri, spans } = labelWorkspace(t);
  const at = { textDocument: { uri: uri('a.md') }, position: { line: 4, character: 10 } };
  assert.deepEqual(service.prepareRename(at), { start: { line: 4, character: 8 }, end: { line: 4, character: 15 } });
  assert.throws(() => service.rename({ ...at, newName: 'fig#2' }), /isn't a valid label/);
  const { changes } = service.rename({ ...at, newName: 'fig-plot' })!;
  assert.deepEqual(spans(Object.entries(changes).flatMap(([u, edits]) => edits.map((e) => ({ uri: u, ...e })))), ['a.md:4:8', 'b.md:0:26', 'b.md:0:5', 'c.md:0:6']);
  service.update(uri('b.md'), '{doc}`a.md` @nope');
  assert.equal(service.prepareRename({ textDocument: { uri: uri('b.md') }, position: { line: 0, character: 7 } }), null);
  assert.equal(service.prepareRename({ textDocument: { uri: uri('b.md') }, position: { line: 0, character: 14 } }), null);
});

test('moving a file updates `{doc}` roles, links and directive arguments that point to it, and nothing else', (t) => {
  const { service, uri } = labelWorkspace(t);
  const text = '{doc}`Intro <a>` [](a.md#sec) [](sub/a.md)\n```{include} /a.md\n```\n';
  service.update(uri('b.md'), text);
  const { changes } = service.willRenameFiles({ files: [{ oldUri: uri('a.md'), newUri: uri('guide/a.md') }] });
  assert.deepEqual(Object.keys(changes).sort(), [uri('a.md'), uri('b.md')]); // `a.md`'s own `x.png` follows it
  const moved = TextDocument.applyEdits(TextDocument.create(uri('b.md'), 'markdown', 0, text), changes[uri('b.md')]);
  assert.equal(moved, '{doc}`Intro <guide/a>` [](guide/a.md#sec) [](sub/a.md)\n```{include} /guide/a.md\n```\n');
});

test('a moved file\'s relative links follow it, and its root-relative ones stay', (t) => {
  const { service, uri } = labelWorkspace(t);
  service.update(uri('b.md'), '[](c.md#x) [](/c.md)');
  const { changes } = service.willRenameFiles({ files: [{ oldUri: uri('b.md'), newUri: uri('guide/b.md') }] });
  assert.deepEqual(changes, { [uri('b.md')]: [{ range: { start: { line: 0, character: 3 }, end: { line: 0, character: 7 } }, newText: '../c.md' }] });
});

test('hover shows mystmd docs for directives, options and roles, but references come first', () => {
  const service = createService(root, stub());
  const { text, at } = marks('```{i|nclude} x.md\n:la|nguage: python\n```\n{k|bd}`Ctrl` {numref}`fig-|built`\n');
  service.update(uri, text);
  const hover = (i: number) => service.hover({ textDocument: { uri }, position: at[i] })?.contents.value;
  assert.match(hover(0)!, /^\*\*\{include\}\*\*\n\nAllows you to include .*\n\n\*\*Argument\*\*: The file path/);
  assert.match(hover(1)!, /^\*\*:language:\*\*\n\nThe language of the code/);
  assert.match(hover(2)!, /^\*\*\{kbd\}\*\*/);
  assert.match(hover(3)!, /^\*\*Figure 2\*\*/);
});

test('completions carry the same docs as hover', () => {
  const service = createService(root, stub());
  const { text, at } = marks('```{fig|\n```\n{numref}`fig-|built`\n');
  service.update(uri, text);
  const doc = (i: number, label: string) => (service.completion({ textDocument: { uri }, position: at[i] }) as any[]).find((x) => x.label === label).documentation.value;
  assert.match(doc(0, 'figure'), /\*\*Options\*\*: .*`:width:`/);
  assert.equal(doc(1, 'fig-built'), service.hover({ textDocument: { uri }, position: at[1] })!.contents.value);
});

test('directive option completion offers the directive\'s options, minus ones already set', () => {
  const service = createService(root, stub());
  const { text, at } = marks('```{figure} a.png\n:name: x\n:|\n```\n');
  service.update(uri, text);
  const items = service.completion({ textDocument: { uri }, position: at[0] }) as any[];
  const labels = items.map((i) => i.label);
  assert.ok(labels.includes('width') && !labels.includes('label'), 'offers figure options, minus `label` (set via its alias `name`)');
  assert.equal(items.find((i) => i.label === 'width').textEdit.newText, 'width: ');
});

test('`/` offers directive templates at the start of a line, and role templates anywhere', () => {
  const service = createService(root, stub());
  const { text, at } = marks('/no|\ntext /k|\n');
  service.update(uri, text);
  const items = (i: number) => service.completion({ textDocument: { uri }, position: at[i] }) as any[];
  const note = items(0).find((i) => i.label === 'note');
  assert.deepEqual(note.textEdit, { range: { start: { line: 0, character: 0 }, end: { line: 0, character: 3 } }, newText: ':::{note} $1\n$0\n:::' });
  assert.equal(note.filterText, '/note');
  assert.ok(note.sortText < items(0).find((i) => i.label === 'admonition').sortText, 'common ones first');
  assert.equal(items(1).find((i) => i.label === 'kbd').textEdit.newText, '{kbd}`$0`');
  assert.ok(!items(1).some((i) => i.label === 'note'), 'no directives mid-line');
});

test('`/` offers directives from myst.yml plugins once they load', async (t) => {
  const dir = tmpWorkspace(t, {
    'myst.yml': 'version: 1\nproject:\n  plugins:\n    - plugin.mjs\n',
    'plugin.mjs': "export default { directives: [{ name: 'myst:demo', body: { type: String } }] };",
  });
  const service = createService(dir, stub());
  const doc = pathToFileURL(join(dir, 'index.md')).href;
  const { text, at } = marks('/my|');
  service.update(doc, text);
  const demo = () => (service.completion({ textDocument: { uri: doc }, position: at[0] }) as any[]).find((i) => i.label === 'myst:demo');
  assert.equal(demo(), undefined);
  await service.loadPlugins();
  assert.equal(demo().textEdit.newText, ':::{myst:demo}\n$0\n:::');
});

test('directive file arguments: links, completion, and a warning when missing', (t) => {
  const dir = tmpWorkspace(t, { 'img/plot.png': '' });
  const service = createService(dir, stub());
  const doc = pathToFileURL(join(dir, 'index.md')).href;
  const { text, at } = marks('```{figure} img/plot.png\n```\n```{image} /img/plot.png\n```\n```{include} missing.md\n```\n```{figure} |');
  service.update(doc, text);
  const png = pathToFileURL(join(dir, 'img', 'plot.png')).href;
  assert.deepEqual(service.documentLinks({ textDocument: { uri: doc } }).map((l) => l.target), [png, png]);
  assert.deepEqual(service.diagnostics(doc).map((d) => d.message), ['File not found: `missing.md`']);
  assert.deepEqual((service.completion({ textDocument: { uri: doc }, position: at[0] }) as any[]).map((i) => i.label), ['img/plot.png']);
});

test('Markdown links to local files get links and go to definition, but no warning when missing', (t) => {
  const dir = tmpWorkspace(t, { 'ch/one.md': '' });
  const service = createService(dir, stub());
  const doc = pathToFileURL(join(dir, 'index.md')).href;
  service.update(doc, '[](ch/one.md#intro) [](missing.md)');
  const one = pathToFileURL(join(dir, 'ch', 'one.md')).href;
  assert.deepEqual(service.documentLinks({ textDocument: { uri: doc } }).map((l) => l.target), [one]);
  assert.equal(service.definition({ textDocument: { uri: doc }, position: { line: 0, character: 5 } })?.uri, one);
  assert.deepEqual(service.diagnostics(doc), []);
});

test('duplicate labels are flagged, but not implicit heading labels', () => {
  const heading = (file: string, line: number) => ({ identifier: 'examples', kind: 'heading', text: 'Examples', file, line, implicit: true });
  const targets = [{ ...built, file: 'index.md', line: 2 }, built, heading('index.md', 4), heading('other.md', 1)];
  const service = createService(root, stubProject(targets));
  service.update(uri, '(fig-built)=\n# Built\n\n## Examples\n');
  assert.deepEqual(service.diagnostics(uri).map((d) => [d.message, d.range.start.line, d.range.start.character]), [['Duplicate label `fig-built`, also defined in chapter/plots.md', 0, 1]]);
});

test('an open document replaces its built page once mystmd has built the project', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const page = (location: string, md: string) => ({ location, mdast: parseMyst(md, { keepTitle: true }).tree });
  let reload = () => {};
  const project = createProject({ pages: async () => [page('/index.md', '(dup)=\n# A\n'), page('/chapter.md', '(dup)=\n# B\n')], watch: (cb) => ((reload = cb), () => {}) }, () => {});
  const service = createService(root, project);
  const duplicates = () => service.diagnostics(uri).map((d) => d.message);
  service.update(uri, '(dup)=\n# A\n');
  assert.deepEqual(duplicates(), []); // not built yet

  reload();
  await new Promise(setImmediate);
  assert.deepEqual(duplicates(), ['Duplicate label `dup`, also defined in chapter.md']);

  // The live parse replaces the built `index.md`, so its URI must map to the content server's location.
  service.update(uri, '# A\n');
  t.mock.timers.tick(150);
  assert.deepEqual(duplicates(), []);

  service.close(uri);
  assert.deepEqual(project.targets().filter((t) => t.identifier === 'dup').map((t) => t.file), ['index.md', 'chapter.md']);
});

test('an open page keeps the built labels of the files it includes', async () => {
  const include = { type: 'include', file: 'part.md', children: parseMyst('(sec-inc)=\n# Inc\n', { keepTitle: true }).tree.children };
  let reload = () => {};
  const project = createProject({ pages: async () => [{ location: '/index.md', mdast: { type: 'root', children: [include] } }], watch: (cb) => ((reload = cb), () => {}) }, () => {});
  reload();
  await new Promise(setImmediate);
  project.setOpen('index.md', '```{include} part.md\n```\n', uri);
  assert.deepEqual(project.targets().map((t) => [t.identifier, t.file]), [['sec-inc', 'part.md']]);
});

test('notebook cells are documents in their notebook file', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const dir = tmpWorkspace(t, { 'nb/plot.png': '' });
  const project = createProject(undefined, () => {});
  const service = createService(dir, project);
  // Cell URIs as JupyterLab sends them; VS Code's `vscode-notebook-cell:` URIs have the same path.
  const nb = pathToFileURL(join(dir, 'nb', 'analysis.ipynb')).href;
  service.update(`${nb}#a`, '(results)=\n# Results\n');
  const { text, at } = marks('See {ref}`re|sults`.\n```{figure} |');
  service.update(`${nb}#b`, text);
  t.mock.timers.tick(150);

  assert.deepEqual(project.targets().map((t) => [t.identifier, t.file]), [['results', 'nb/analysis.ipynb']]);
  assert.deepEqual(service.definition({ textDocument: { uri: `${nb}#b` }, position: at[0] })?.uri, `${nb}#a`);
  assert.deepEqual(service.documentSymbols({ textDocument: { uri: `${nb}#b` } }), []);
  assert.deepEqual((service.completion({ textDocument: { uri: `${nb}#b` }, position: at[1] }) as any[]).map((i) => i.label), ['plot.png']);
});

test('mystmd\'s own warnings are diagnostics, minus ones about references and plugins\' directives', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const text = '(a)=\nA\n\n(a)=\n:::{nope}\n:::\n```{figure} x.png\n:badopt: 1\n```\nSee {ref}`missing` and @key.\n';
  const warnings = (myst: string) => {
    const dir = tmpWorkspace(t, { 'myst.yml': myst, 'x.png': '' });
    const service = createService(dir, createProject(undefined, () => {}));
    const doc = pathToFileURL(join(dir, 'index.md')).href;
    service.update(doc, text);
    t.mock.timers.tick(150);
    return service.diagnostics(doc).map((d) => [d.message, d.severity, d.range.start.line, d.range.end.character]);
  };
  assert.deepEqual(warnings('version: 1\n'), [
    ['unknown directive: nope', DiagnosticSeverity.Error, 4, 9],
    ['unexpected option "badopt" provided (in figure)', DiagnosticSeverity.Warning, 7, 10],
  ]);
  assert.deepEqual(warnings('project:\n  plugins: [plugin.mjs]\n').map((w) => w[0]), ['unexpected option "badopt" provided (in figure)']);
});
