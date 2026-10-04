import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, realpathSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { findProjectRoot } from './root.ts';
import { tmpWorkspace } from './test-helpers.ts';

test('the project is the nearest myst.yml, but not one beyond a git repository', (t) => {
  const top = realpathSync(tmpWorkspace(t));
  const deep = join(top, 'repo', 'docs', 'a', 'b');
  mkdirSync(deep, { recursive: true });
  mkdirSync(join(top, 'repo', '.git'));
  writeFileSync(join(top, 'myst.yml'), ''); // unrelated: above the repo
  assert.equal(findProjectRoot(deep), undefined);

  writeFileSync(join(top, 'repo', 'myst.yml'), ''); // the repo's own project, at its root
  assert.equal(findProjectRoot(deep), join(top, 'repo'));

  writeFileSync(join(top, 'repo', 'docs', 'myst.yml'), ''); // a nested project wins
  assert.equal(findProjectRoot(deep), join(top, 'repo', 'docs'));
});
