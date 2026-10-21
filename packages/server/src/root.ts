import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { load } from 'js-yaml';

/**
 * The project folder for `start`: the nearest folder at or above `start` that has a `myst.yml`.
 * The search stops at the innermost workspace folder in `ceilings` that contains `start`.
 * Nothing above the folder you opened is picked up, so a stray `myst.yml` there is never built.
 */
export function findProjectRoot(start: string, ceilings: string[]): string | undefined {
  // The innermost workspace folder, in case one is inside another.
  const ceiling = ceilings.filter((c) => !relative(c, start).startsWith('..')).sort((a, b) => b.length - a.length)[0];
  if (!ceiling) return;
  for (let dir = start; ; dir = dirname(dir)) {
    if (existsSync(join(dir, 'myst.yml'))) return dir;
    if (dir === ceiling || dirname(dir) === dir) return;
  }
}

/** The `project` section of the project's `myst.yml`, or {} if it can't be read. */
export function readProjectConfig(root: string): Record<string, any> {
  try {
    return (load(readFileSync(join(root, 'myst.yml'), 'utf8')) as any)?.project ?? {};
  } catch {
    return {};
  }
}

/**
 * The Markdown cells of the notebook `json` at `uri`, as [URI, text] pairs.
 * A cell's URI is `uri` with the cell id as the fragment, as JupyterLab sends it.
 * Cells without an id are left out.
 */
export function markdownCells(uri: string, json: string): (readonly [string, string])[] {
  try {
    const { cells = [] } = JSON.parse(json);
    return cells.filter((c: any) => c.cell_type === 'markdown' && c.id).map((c: any) => [`${uri}#${c.id}`, [c.source].flat().join('')] as const);
  } catch {
    return [];
  }
}

export function workspaceFiles(dir: string, pattern = /\.(md|ipynb)$/): string[] {
  if (!existsSync(dir)) return []; // the tests use roots that aren't on disk
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    if (e.name.startsWith('.') || e.name === 'node_modules' || e.name === '_build') return [];
    const path = join(dir, e.name);
    return e.isDirectory() ? workspaceFiles(path, pattern) : pattern.test(e.name) ? [path] : [];
  });
}

/**
 * A document's path. Notebook cells are documents with the notebook's path and a fragment for the cell:
 * `file:///nb.ipynb#<cell id>` from JupyterLab, `vscode-notebook-cell:/nb.ipynb#...` from VS Code.
 */
export const pathOf = (uri: string) => fileURLToPath('file:' + uri.slice(uri.indexOf(':') + 1));
