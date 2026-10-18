import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { extname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

type PluginInfo = string | { type: string; path: string };

/**
 * The directives and roles of myst.yml's JavaScript plugins, from the same files mystmd loads.
 * mystmd downloads a plugin URL to `_build/cache/config-item-<md5 of the URL><ext>`, in myst-cli's `resolveToAbsolute`.
 * So a plugin URL is found only after mystmd has built once.
 * Importing a plugin runs its code, so call this only when mystmd runs for the project.
 */
export async function pluginSpecs(root: string, plugins: PluginInfo[] = []) {
  const files = plugins.flatMap((p) => {
    const { type, path } = typeof p === 'string' ? { type: 'javascript', path: p } : p;
    if (type !== 'javascript') return [];
    const file = /^https?:\/\//.test(path) ? join(root, '_build', 'cache', `config-item-${createHash('md5').update(path).digest('hex')}${extname(new URL(path).pathname)}`) : resolve(root, path);
    return existsSync(file) ? [file] : [];
  });
  const modules = await Promise.all(files.map((f) => import(pathToFileURL(f).href).catch(() => undefined)));
  // Like mystmd: specs from the default (or `plugin`) export, else from the module.
  const specs = modules.filter(Boolean).map((m) => ({ ...m, ...(m.default ?? m.plugin) }));
  return { directives: specs.flatMap((s) => s.directives ?? []), roles: specs.flatMap((s) => s.roles ?? []) };
}
