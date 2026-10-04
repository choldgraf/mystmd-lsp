import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';

/**
 * The project folder for a workspace: the nearest folder at or above `start` that has a `myst.yml`.
 * The search stops at a git repository's root, the home folder, or the filesystem root, so a `myst.yml` far above that isn't part of this project is never picked up.
 */
export function findProjectRoot(start: string): string | undefined {
  for (let dir = start; dir !== homedir(); dir = dirname(dir)) {
    if (existsSync(join(dir, 'myst.yml'))) return dir;
    if (existsSync(join(dir, '.git')) || dirname(dir) === dir) return;
  }
}
