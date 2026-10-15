import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createProject } from './project.ts';

test('once built, only the pages mystmd lists define targets', async () => {
  let reload = () => {};
  const project = createProject({ pages: async () => [{ location: '/index.md', mdast: { type: 'root', children: [] } }], watch: (cb) => ((reload = cb), () => {}) }, () => {});
  project.setOpen('other.md', '(stray)=\n# Stray\n', 'file:///p/other.md');
  assert.ok(project.isPage('other.md')); // not built yet: anything counts
  assert.deepEqual(project.targets().map((t) => t.identifier), ['stray']);

  reload();
  await new Promise(setImmediate);
  assert.ok(project.isPage('index.md'));
  assert.ok(!project.isPage('other.md'));
  assert.deepEqual(project.targets(), []);
});
