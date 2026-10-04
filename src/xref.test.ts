import { test } from 'node:test';
import assert from 'node:assert/strict';
import { deflateSync } from 'node:zlib';
import { parseInventory, resolveXref, splitXref, syncXrefs, type XrefProject } from './xref.ts';

test('syncXrefs keeps unchanged projects, drops removed or moved ones, and loads new ones', { timeout: 5000 }, async () => {
  const offline = 'http://127.0.0.1:1'; // refuses connections, so loads finish fast with no entries
  const xrefs: Record<string, XrefProject> = {
    kept: { url: `${offline}/kept`, entries: [] },
    moved: { url: `${offline}/old`, entries: [] },
    removed: { url: `${offline}/removed`, entries: [] },
  };
  await new Promise<void>((resolve) => {
    let loads = 0;
    syncXrefs(xrefs, { kept: `${offline}/kept`, moved: `${offline}/new`, added: `${offline}/added` }, () => ++loads === 2 && resolve());
  });
  assert.deepEqual(xrefs, { kept: { url: `${offline}/kept`, entries: [] }, moved: { url: `${offline}/new` }, added: { url: `${offline}/added` } });
});

test('parseInventory reads a Sphinx objects.inv', () => {
  const header = '# Sphinx inventory version 2\n# Project: X\n# Version: 1\n# The remainder of this file is compressed using zlib.\n';
  const body = 'library/abc std:doc -1 library/abc.html abc — Abstract Base Classes\nabc.ABC py:class 1 library/abc.html#$ -\n';
  const entries = parseInventory(Buffer.concat([Buffer.from(header), deflateSync(body)]), 'https://docs.python.org/3/');
  assert.deepEqual(entries, [
    { name: 'library/abc', kind: 'std:doc', title: 'abc — Abstract Base Classes', url: 'https://docs.python.org/3/library/abc.html' },
    { name: 'abc.ABC', kind: 'py:class', title: 'abc.ABC', url: 'https://docs.python.org/3/library/abc.html#abc.ABC' },
  ]);
  const project = { url: 'https://docs.python.org/3/', kind: 'sphinx' as const, entries };
  const { page, hash } = splitXref('python#abc.ABC');
  assert.equal(resolveXref(project, page, hash)?.kind, 'py:class');
  assert.equal(resolveXref(project, '', 'nope'), undefined);
});
