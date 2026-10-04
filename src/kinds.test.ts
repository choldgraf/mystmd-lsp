import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CompletionItemKind } from 'vscode-languageserver';
import { kindIcon } from './kinds.ts';

test('kinds from MyST and Sphinx get icons, and unknown kinds get `Reference`', () => {
  assert.equal(kindIcon('figure'), CompletionItemKind.Color);
  assert.equal(kindIcon('py:function'), CompletionItemKind.Function);
  assert.equal(kindIcon('std:label'), CompletionItemKind.Reference);
  assert.equal(kindIcon('definitionTerm'), CompletionItemKind.Reference);
});
