import type { BuiltPage } from 'mystmd-client/content-server';
import { parseMyst } from 'mystmd-client/parse';
import { targetsFromTree, type Target } from './index-targets.ts';

/**
 * The project's reference targets, each with its file (project-relative path, e.g. `chapter.md`).
 * Built pages come from `server`, the `myst start` content server. Open documents replace their file's targets with a live parse.
 * Open documents are keyed by URI, since a notebook's Markdown cells are separate documents in one file.
 */
export function createProject(server: { pages(): Promise<Pick<BuiltPage, 'location' | 'mdast'>[]>; watch(onReload: () => void): () => void } | undefined, onChange: () => void) {
  let built: Target[] = [];
  // The files mystmd built, as project-relative paths: what counts as a page of the project once it's loaded.
  let pages = new Set<string>();
  const open = new Map<string, { file: string; targets: Target[]; messages: ReturnType<typeof parseMyst>['messages'] }>();
  // Without a content server we only know the open documents, so we never claim a target is missing.
  let loaded = false;

  async function load() {
    // A page's targets include those of the files it includes, filed under those files.
    const fetched = await server!.pages();
    const fileOf = (page: { location: string }) => page.location.replace(/^\//, '');
    built = fetched.flatMap((page) => targetsFromTree(page.mdast, fileOf(page)));
    pages = new Set(fetched.map(fileOf));
    loaded = true;
    onChange();
  }
  const stop = server?.watch(() => load().catch((e) => console.error(`[lsp] failed to load project: ${e}`)));
  /** Whether `file` is a page of the project. Until the first build is indexed, or without a content server, anything is. */
  const isPage = (file: string) => !loaded || pages.has(file);

  return {
    /** Stop watching for rebuilds, e.g. once mystmd has exited. */
    unwatch: () => stop?.(),
    get loaded() {
      return loaded;
    },
    isPage,
    targets(): Target[] {
      // An open file that isn't a page (outside the toc, in `_build`) doesn't define labels, so it can't cause duplicates.
      const docs = [...open.values()].filter((d) => isPage(d.file));
      const openFiles = new Set(docs.map((d) => d.file));
      return [...built.filter((t) => !openFiles.has(t.file)), ...docs.flatMap((d) => d.targets)];
    },
    setOpen(file: string, text: string, uri: string) {
      // Keep a leading `# Title`, which mystmd removes, for the outline and labels.
      const { tree, messages } = parseMyst(text, { keepTitle: true });
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
