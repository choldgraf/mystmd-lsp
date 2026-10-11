import type { BuiltPage } from './mystmd/content-server.ts';
import { parseMyst } from './mystmd/parse.ts';
import { targetsFromTree, type Target } from './index-targets.ts';

/**
 * The project's reference targets, each with its file (project-relative path, e.g. `chapter.md`).
 * Built pages come from `server` (the `myst start` content server); open documents replace their file's targets with a live parse.
 * Open documents are keyed by URI, since a notebook's Markdown cells are separate documents in one file.
 */
export function createProject(server: { pages(): Promise<BuiltPage[]>; watch(onReload: () => void): void } | undefined, onChange: () => void) {
  let built: Target[] = [];
  const open = new Map<string, { file: string; targets: Target[]; messages: ReturnType<typeof parseMyst>['messages'] }>();
  // Without a content server we only know the open documents, so we never claim a target is missing.
  let loaded = false;

  async function load() {
    // A page's targets include those of the files it includes, filed under those files.
    built = (await server!.pages()).flatMap((page) => targetsFromTree(page.mdast, page.location.replace(/^\//, '')));
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
      return [...built.filter((t) => !openFiles.has(t.file)), ...docs.flatMap((d) => d.targets)];
    },
    setOpen(file: string, text: string, uri: string) {
      const { tree, messages } = parseMyst(text);
      open.set(uri, { file, targets: targetsFromTree(tree, file).map((t) => ({ ...t, uri })), messages });
      onChange();
    },
    /** mystmd's warnings from an open document's last parse. */
    messages(uri: string) {
      return open.get(uri)?.messages ?? [];
    },
    close(uri: string) {
      open.delete(uri);
      onChange();
    },
  };
}
