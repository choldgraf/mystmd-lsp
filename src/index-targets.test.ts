import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseMyst } from 'mystmd-client/parse';
import { targetsFromTree } from './index-targets.ts';

const doc = `(intro)=
# Introduction

\`\`\`{figure} logo.png
:label: fig-logo

The *logo*.
\`\`\`

$$e^{i\\pi}+1=0$$ (euler)

See {ref}\`intro\`.
`;

test('targetsFromTree finds headings, figures and equations', () => {
  const targets = targetsFromTree(parseMyst(doc, { keepTitle: true }).tree, 'index.md');
  assert.deepEqual(
    targets.map((t) => [t.identifier, t.kind, t.text, t.enumerator, t.line]),
    [
      ['intro', 'heading', 'Introduction', undefined, 2],
      ['fig-logo', 'figure', 'The logo.', '1', 4],
      ['euler', 'equation', 'e^{i\\pi}+1=0', '1', 10],
    ],
  );
});

test('page frontmatter numbers targets, and a leading heading stays a target', () => {
  const targets = targetsFromTree(parseMyst('---\nnumbering:\n  figure:\n    start: 5\n---\n' + doc, { keepTitle: true }).tree, 'index.md');
  assert.deepEqual(targets.map((t) => [t.identifier, t.enumerator]), [['intro', undefined], ['fig-logo', '5'], ['euler', '1']]);
});

test('targetsFromTree finds labelled images', () => {
  const targets = targetsFromTree(parseMyst('(logo)=\n![x](a.png)\n').tree, 'index.md');
  assert.deepEqual(targets.map((t) => [t.identifier, t.kind]), [['logo', 'image']]);
});

test('targetsFromTree finds glossary terms with their definitions', () => {
  const targets = targetsFromTree(parseMyst(':::{glossary}\nMyST Markdown\n: A markup language.\n:::\n').tree, 'index.md');
  assert.deepEqual(targets.map((t) => [t.identifier, t.kind, t.text, t.doc, t.line]), [['term-myst markdown', 'term', 'MyST Markdown', 'A markup language.', 2]]);
});

test('targets in included content are filed under the included file', () => {
  const tree = { type: 'root', children: [{ type: 'include', file: '../README.md', children: [{ type: 'heading', identifier: 'usage', depth: 2, children: [{ type: 'text', value: 'Usage' }], position: { start: { line: 9 } } }] }] };
  assert.deepEqual(targetsFromTree(tree as any, 'docs/index.md').map((t) => [t.file, t.line]), [['README.md', 9]]);
});
