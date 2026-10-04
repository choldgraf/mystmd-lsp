import type { BuiltPage } from './mystmd/content-server.ts';
import { parseMyst } from './mystmd/parse.ts';
import { targetsFromTree, type Target } from './index-targets.ts';

/**
 * The project's reference targets, keyed by file (project-relative path, e.g. `chapter.md`).
 * Built pages come from `server` (the `myst start` content server); open documents override their file with a live parse.
 * Open documents are keyed by URI, since a notebook's Markdown cells are separate documents in one file.
 */
export function createProject(server: { pages(): Promise<BuiltPage[]>; watch(onReload: () => void): void } | undefined, onChange: () => void) {
  let built = new Map<string, Target[]>();
  const open = new Map<string, { file: string; targets: Target[] }>();
  // Without a content server we only know the open documents, so we never claim a target is missing.
  let loaded = false;

  async function load() {
    built = new Map((await server!.pages()).map((page) => {
      const file = page.location.replace(/^\//, '');
      return [file, targetsFromTree(page.mdast, file)];
    }));
    loaded = true;
    onChange();
  }
  server?.watch(() => load().catch((e) => console.error(`[lsp] failed to load project: ${e}`)));

  return {
    get loaded() {
      return loaded;
    },
    targets(): Target[] {
      const docs = [...open.values()];
      const openFiles = new Set(docs.map((d) => d.file));
      return [...[...built].filter(([f]) => !openFiles.has(f)).flatMap(([, t]) => t), ...docs.flatMap((d) => d.targets)];
    },
    setOpen(file: string, text: string, uri: string) {
      open.set(uri, { file, targets: targetsFromTree(parseMyst(text).tree, file).map((t) => ({ ...t, uri })) });
      onChange();
    },
    close(uri: string) {
      open.delete(uri);
      onChange();
    },
  };
}
