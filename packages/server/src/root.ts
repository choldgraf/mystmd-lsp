import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { load } from 'js-yaml';

/**
 * A document's project: the nearest folder at or above `start` with a `myst.yml`, no higher than the workspace folder (one of `ceilings`) that holds it.
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
