import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { load } from 'js-yaml';

/**
 * The project folder for a workspace: the nearest folder at or above `start` that has a `myst.yml`.
 * The search stops at a git repository's root, at the filesystem root, or just below the home folder, so a `myst.yml` far above that isn't part of this project is never picked up.
 */
export function findProjectRoot(start: string): string | undefined {
  for (let dir = start; dir !== homedir(); dir = dirname(dir)) {
    if (existsSync(join(dir, 'myst.yml'))) return dir;
    if (existsSync(join(dir, '.git')) || dirname(dir) === dir) return;
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
