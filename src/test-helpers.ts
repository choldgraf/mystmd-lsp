import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import type { TestContext } from 'node:test';
import type { Target } from './index-targets.ts';

/** A temp folder holding `files` (path → text), removed when the test ends. */
export function tmpWorkspace(t: TestContext, files: Record<string, string> = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'lsp-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(dirname(join(dir, path)), { recursive: true });
    writeFileSync(join(dir, path), text);
  }
  return dir;
}

/** Text with each `|` marking a cursor: the text without the markers, and where they were. */
export function marks(marked: string) {
  const at: { line: number; character: number }[] = [];
  let text = '';
  let line = 0;
  let character = 0;
  for (const c of marked) {
    if (c === '|') at.push({ line, character });
    else {
      text += c;
      [line, character] = c === '\n' ? [line + 1, 0] : [line, character + 1];
    }
  }
  return { text, at };
}

/** A project that has finished loading, with fixed targets. `opened` records the files the service asked it to parse. */
export function stubProject(targets: Target[]) {
  const opened: string[] = [];
  return { opened, loaded: true, targets: () => targets, setOpen: (file: string) => opened.push(file), close() {}, messages: () => [] };
}
