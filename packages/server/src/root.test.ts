import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { findProjectRoot } from './root.ts';
import { tmpWorkspace } from './test-helpers.ts';

test('the project is the nearest myst.yml at or below the workspace folder', (t) => {
  const top = tmpWorkspace(t);
  const ws = join(top, 'ws');
  const deep = join(ws, 'docs', 'a', 'b');
  mkdirSync(deep, { recursive: true });
  writeFileSync(join(top, 'myst.yml'), ''); // above the workspace folder: never found
  assert.equal(findProjectRoot(deep, [ws]), undefined);

  writeFileSync(join(ws, 'myst.yml'), ''); // the workspace folder itself counts
  assert.equal(findProjectRoot(deep, [ws]), ws);

  writeFileSync(join(ws, 'docs', 'myst.yml'), ''); // a nested project wins
  assert.equal(findProjectRoot(deep, [ws]), join(ws, 'docs'));

  assert.equal(findProjectRoot(top, [ws]), undefined); // not under the workspace folder

  const inner = join(top, 'inner'); // a workspace folder inside another: the inner one is the ceiling
  assert.equal(findProjectRoot(join(inner, 'x'), [top, inner]), undefined);
  assert.equal(findProjectRoot(join(inner, 'x'), [top]), top);
});
