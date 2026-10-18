import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { normalizeLabel } from 'myst-common';
import { CompletionItemKind, DiagnosticSeverity, ErrorCodes, InsertTextFormat, ResponseError, SemanticTokensBuilder, SymbolKind, type CompletionItem, type Diagnostic, type DocumentSymbol, type Position, type TextEdit } from 'vscode-languageserver';
import { directives, roles } from 'mystmd-client/parse';
import { authorYear, readBibliography, type BibEntry } from './cite.ts';
import { kindIcon } from './kinds.ts';
import type { createProject } from './project.ts';
import { pluginSpecs } from './plugins.ts';
import { readProjectConfig } from './root.ts';
import { labelChars, labelDefinition, nameAt, optionAt, refAt, refsInText, splitLines, type Ref } from './syntax.ts';
import type { Target } from './index-targets.ts';
import { resolveXref, splitXref, type XrefEntry, type XrefProject } from './xref.ts';

// Directive and role specs by name and alias.
const byName = <T extends { name: string; alias?: string[] }>(specs: T[]) => new Map(specs.flatMap((s) => [s.name, ...(s.alias ?? [])].map((n) => [n, s] as const)));
// Spec types are names like `myst` (MyST Markdown), or constructors like `String`.
type Param = { type?: string | { name: string }; doc?: string; required?: boolean };
function typeName(type: Param['type']) {
  if (type === 'myst') return 'markdown';
  return typeof type === 'string' ? type : type?.name.toLowerCase();
}
// `(string, optional)`, or nothing when every part is empty.
const parens = (...parts: (string | false | undefined)[]) => (parts.some(Boolean) ? `(${parts.filter(Boolean).join(', ')})` : '');
/** Markdown docs for a directive, role or option spec, laid out like a docstring: its description, argument, body and options. */
function specDoc(spec?: { doc?: string; arg?: Param; body?: Param; options?: Record<string, Param> }) {
  // Only the first paragraph of the argument and body, and the first line of each option, to keep it short.
  const param = (name: string, p?: Param) => p && [`**${name}**`, parens(typeName(p.type), !p.required && 'optional')].filter(Boolean).join(' ') + (p.doc ? `: ${p.doc.split('\n\n')[0]}` : '');
  const options = Object.entries(spec?.options ?? {}).map(([k, o]) => ['-', `\`${k}\``, parens(typeName(o.type)), o.doc?.split('\n')[0]].filter(Boolean).join(' '));
  return [spec?.doc, param('Argument', spec?.arg), param('Body', spec?.body), options.length && `**Options**\n\n${options.join('\n')}`].filter(Boolean).join('\n\n');
}
// LSP Markdown content, or nothing when there's no text, so clients don't show an empty panel.
const markdown = (value?: string) => (value ? { kind: 'markdown' as const, value } : undefined);
// Directives and roles listed first in the `/` menu.
const common = new Set(['note', 'warning', 'tip', 'figure', 'code-block', 'math', 'table', 'dropdown', 'tab-set', 'ref', 'doc', 'cite', 'term', 'kbd']);

/** "Figure 1", "Equation (1)", "Section" */
function title(t: Target) {
  const kind = t.kind === 'heading' ? 'Section' : t.kind[0].toUpperCase() + t.kind.slice(1);
  if (!t.enumerator) return kind;
  return t.kind === 'equation' ? `${kind} (${t.enumerator})` : `${kind} ${t.enumerator}`;
}

/** Markdown showing what a target is: an equation's LaTeX, a term's definition, or a caption or heading. */
function preview(t: Target) {
  return t.kind === 'equation' ? `\`\`\`latex\n${t.text}\n\`\`\`` : t.doc ?? t.text;
}

/** The ghost text shown after a resolved reference. */
function hint(t: Target) {
  if (t.kind === 'equation' && t.enumerator) return `(${t.enumerator})`;
  return t.enumerator || !t.text ? title(t) : `${title(t)}: ${t.text}`;
}

/**
 * Semantic tokens: each reference is a `label`, with its target's kind as a modifier (e.g. `label.figure`).
 * Kinds not listed here get the bare `label` type.
 */
export const semanticTokensLegend = {
  tokenTypes: ['label'],
  tokenModifiers: ['heading', 'figure', 'table', 'equation', 'code', 'blockquote', 'image', 'list', 'paragraph', 'proof', 'exercise', 'admonition', 'page', 'citation', 'term'],
};

const rangeOf = (ref: Pick<Ref, 'line' | 'start' | 'end'>) => ({ start: { line: ref.line, character: ref.start }, end: { line: ref.line, character: ref.end } });
// References to files rather than labels, which a file move rewrites (see features.md, Find references and rename).
const isFile = (ref: Ref) => ref.kind === 'doc' || ref.kind === 'path';

type At = { textDocument: { uri: string }; position: Position };

/** What a reference points to. `problem` is a warning for a `missing` target, set only when we're sure it doesn't exist. */
type Resolved =
  | { kind: 'label'; target: Target }
  | { kind: 'citation'; entry: BibEntry }
  | { kind: 'xref'; entry: XrefEntry }
  | { kind: 'file'; path: string }
  | { kind: 'missing'; problem?: string };

/** The Markdown cells of the notebook `json` at `uri`: each one's URI as JupyterLab sends it (with the cell id as the fragment), and its text. */
export function markdownCells(uri: string, json: string): (readonly [string, string])[] {
  try {
    const { cells = [] } = JSON.parse(json);
    return cells.filter((c: any) => c.cell_type === 'markdown' && c.id).map((c: any) => [`${uri}#${c.id}`, [c.source].flat().join('')] as const);
  } catch {
    return [];
  }
}

export function workspaceFiles(dir: string, pattern = /\.(md|ipynb)$/): string[] {
  if (!existsSync(dir)) return []; // a root that doesn't exist on disk, as the tests' don't, has no files
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

/**
 * The language server's features, without an LSP connection.
 * `root` is the project folder. `project` indexes the built pages and open files.
 * `xrefs` are the external projects from myst.yml `project.references`, by key. They're read on each request, so they can load later.
 * Each method takes and returns the LSP request's params and result.
 */
export function createService(root: string, project: ReturnType<typeof createProject>, xrefs: Record<string, XrefProject> = {}) {
  const texts = new Map<string, string>(); // open documents by URI
  const timers = new Map<string, ReturnType<typeof setTimeout>>();

  // Files are project-relative when inside `root` (matching the content server's `location`), else absolute paths.
  const toFile = (uri: string) => {
    const path = pathOf(uri);
    return relative(root, path).startsWith('..') ? path : relative(root, path).split(sep).join('/');
  };
  // Citations from the project's .bib files, read on startup and again on `reloadConfig()`.
  let bib = { entries: [] as BibEntry[], complete: false };
  let citations = new Map<string, BibEntry>();
  // Whether myst.yml lists plugins, so we can't tell an unknown directive or role from a plugin's that didn't load.
  let plugins = false;
  // The same directives and roles as mystmd's parser (`mystmd-client/parse`), plus the plugins' once `loadPlugins` runs.
  let directiveSpecs = byName(directives);
  let roleSpecs = byName(roles);
  const reloadConfig = () => {
    const config = readProjectConfig(root);
    // Like mystmd: `project.bibliography` from myst.yml, else every `.bib` in the project.
    const files: string[] = [config.bibliography ?? workspaceFiles(root, /\.bib$/)].flat();
    bib = readBibliography(root, files);
    citations = new Map(bib.entries.map((e) => [e.key, e]));
    plugins = !!config.plugins?.length;
  };

  const toUri = (file: string) => pathToFileURL(resolve(root, file)).href;
  // mystmd resolves file paths relative to the current file, or to the project folder when they start with `/`.
  const fileOf = (uri: string, path: string) => (path.startsWith('/') ? join(root, path) : join(dirname(pathOf(uri)), path));
  // A location at the start of a line (0-based).
  const point = (uri: string, line: number) => ({ uri, range: { start: { line, character: 0 }, end: { line, character: 0 } } });
  const uriOf = (t: Target) => t.uri ?? toUri(t.file);
  const locationOf = (t: Target) => point(uriOf(t), t.line - 1);
  // Targets in an open document: its own live parse, or its file's built targets until that's ready.
  // Built targets don't say which notebook cell they're in, so a cell only gets its own live-parsed ones.
  const inDocument = (t: Target, uri: string) => (t.uri ? t.uri === uri : !uri.includes('#') && t.file === toFile(uri));

  const lookup = () => new Map(project.targets().map((t) => [t.identifier, t]));
  // How mystmd turns the text of a label into the identifier that targets have.
  const labelId = (text: string) => normalizeLabel(text)?.identifier ?? '';
  reloadConfig();

  /** What a reference in document `uri` points to. Callers resolving many references pass `targets` from one `lookup()`. */
  function resolveRef(ref: Ref, uri: string, targets = lookup()): Resolved {
    if (ref.kind === 'xref') {
      const { key, page, hash } = splitXref(ref.target);
      const p = xrefs[key];
      if (!p) return { kind: 'missing', problem: `Unknown external project \`${key}\` (add it to \`project.references\` in myst.yml)` };
      const entry = p.entries && resolveXref(p, page, hash);
      if (entry) return { kind: 'xref', entry };
      // Only once the inventory has loaded: offline or unreachable projects must not produce false errors.
      return { kind: 'missing', problem: p.entries ? `\`${ref.target}\` not found in ${key} (${p.url})` : undefined };
    }
    if (isFile(ref)) {
      const path = fileOf(uri, ref.target);
      if (existsSync(path)) return { kind: 'file', path };
      return { kind: 'missing', problem: ref.kind === 'path' ? `File not found: \`${ref.target}\`` : undefined };
    }
    // mystmd reads `@key` and `{cite}` keys as citations first, and only falls back to labels when there's no such citation.
    const entry = ref.kind === 'cite' ? citations.get(ref.target) : undefined;
    if (entry) return { kind: 'citation', entry };
    // Like mystmd, a `{term}` points at the glossary term's label, `term-` and its normalized text.
    const target = targets.get(ref.kind === 'term' ? `term-${labelId(ref.target)}` : labelId(ref.target));
    if (target) return { kind: 'label', target };
    if (!project.loaded) return { kind: 'missing' };
    if (ref.kind === 'term') return { kind: 'missing', problem: `Unknown glossary term \`${ref.target}\`` };
    if (ref.kind !== 'cite') return { kind: 'missing', problem: `Unknown reference target \`${ref.target}\`` };
    // Citation keys are only checked when every .bib file was read, and DOIs (`@10.1234/x`) resolve without one.
    return { kind: 'missing', problem: bib.complete && !/^10\.\d+\//.test(ref.target) ? `Unknown citation or reference target \`${ref.target}\`` : undefined };
  }

  const refs = (uri: string) => refsInText(texts.get(uri) ?? '');
  const linesOf = (uri: string) => splitLines(texts.get(uri) ?? '');
  /** Each reference in a document, by default an open one, with what it points to. */
  const resolvedRefs = (uri: string, text = texts.get(uri) ?? '') => {
    const targets = lookup();
    return refsInText(text).map((ref) => [ref, resolveRef(ref, uri, targets)] as const);
  };
  const refAtCursor = ({ textDocument, position: { line, character } }: At) =>
    refs(textDocument.uri).find((r) => r.line === line && r.start <= character && character <= r.end);

  // Open documents' unsaved text, else the file on disk.
  const source = (uri: string) => {
    try {
      return texts.get(uri) ?? readFileSync(pathOf(uri), 'utf8');
    } catch {
      return '';
    }
  };

  /** The project label under the cursor, on a reference or where it's defined, and the span of its name there. */
  function labelAtCursor(at: At) {
    const { line, character } = at.position;
    const ref = refAtCursor(at);
    if (ref) {
      const r = resolveRef(ref, at.textDocument.uri);
      return r.kind === 'label' ? { target: r.target, range: rangeOf(ref) } : undefined;
    }
    const def = labelDefinition(linesOf(at.textDocument.uri)[line] ?? '');
    if (!def || character < def.start || def.end < character) return;
    const target = lookup().get(labelId(def.target));
    return target && { target, range: rangeOf({ ...def, line }) };
  }

  /** Where a label is written. The definition closest to the target's line, since built directives can report a line inside them. */
  function definitionOf(t: Target, uri = uriOf(t)) {
    const defs = splitLines(source(uri)).flatMap((text, line) => {
      const d = labelDefinition(text);
      return d && labelId(d.target) === t.identifier ? [{ ...d, line }] : [];
    });
    const d = defs.sort((a, b) => Math.abs(a.line - t.line + 1) - Math.abs(b.line - t.line + 1))[0];
    return d && { uri, range: rangeOf(d) };
  }

  /** The URI and text of the project's Markdown files and open documents, and with `notebooks`, of the Markdown cells of notebooks on disk. */
  function projectDocs(notebooks: boolean) {
    // Skip files that are open: the client's URI for them can be encoded differently from ours.
    const open = new Set([...texts.keys()].map(pathOf));
    const files = workspaceFiles(root, notebooks ? /\.(md|ipynb)$/ : /\.md$/).filter((f) => !open.has(f));
    const uris = files.map(toUri);
    // Only pages: a file the build leaves out (or a nested project's) is neither searched nor edited.
    return [...uris.flatMap((uri) => (uri.endsWith('.ipynb') ? markdownCells(uri, source(uri)) : [[uri, source(uri)] as const])), ...texts].filter(([uri]) => project.isPage(toFile(uri)));
  }

  /** Every reference to a label in `projectDocs`. */
  function labelRefs(identifier: string, notebooks = false) {
    const docs = projectDocs(notebooks);
    const targets = lookup();
    const isRef = (r: Resolved) => r.kind === 'label' && r.target.identifier === identifier;
    return docs.flatMap(([uri, text]) => refsInText(text).filter((r) => isRef(resolveRef(r, uri, targets))).map((r) => ({ uri, range: rangeOf(r) })));
  }

  /** mystmd's docs for the directive, directive option, or role name under the cursor. */
  function specHover({ textDocument, position }: At) {
    const n = nameAt(linesOf(textDocument.uri), position.line, position.character);
    if (!n) return null;
    const spec =
      n.kind === 'option'
        ? Object.entries(directiveSpecs.get(n.directive)?.options ?? {}).find(([k, o]) => k === n.name || o.alias?.includes(n.name))?.[1]
        : (n.kind === 'directive' ? directiveSpecs : roleSpecs).get(n.name);
    const doc = specDoc(spec);
    const name = n.kind === 'option' ? `:${n.name}:` : `{${n.name}}`;
    return doc ? { contents: { kind: 'markdown' as const, value: `**${name}**\n\n${doc}` } } : null;
  }

  /** Options of the enclosing directive (from its mystmd spec), minus ones already set. */
  function optionItems(opt: NonNullable<ReturnType<typeof optionAt>>, line: number): CompletionItem[] {
    const options = directiveSpecs.get(opt.directive)?.options ?? {};
    const range = rangeOf({ line, ...opt });
    return Object.entries(options)
      .filter(([key, o]) => ![key, ...(o.alias ?? [])].some((k) => opt.used.includes(k)))
      .map(([key, o]) => ({
        label: key,
        kind: CompletionItemKind.Property,
        detail: typeName(o.type),
        documentation: markdown(o.doc),
        textEdit: { range, newText: `${key}: ` },
      }));
  }

  const service = {
    reloadConfig,
    /** Add the directives and roles of myst.yml's plugins, or keep the specs as they were if `plugins` is malformed. This imports them, so only call it when mystmd runs the project. */
    loadPlugins: async () => {
      try {
        const specs = await pluginSpecs(root, readProjectConfig(root).plugins);
        directiveSpecs = byName([...directives, ...specs.directives]);
        roleSpecs = byName([...roles, ...specs.roles]);
      } catch {}
    },
    /** Whether the document is a page of the project, which is what gets language features. */
    isPage: (uri: string) => project.isPage(toFile(uri)),

    /** Set an open document's text. The project re-parses it shortly after typing stops, then calls its `onChange`. */
    update(uri: string, text: string) {
      texts.set(uri, text);
      clearTimeout(timers.get(uri));
      timers.set(uri, setTimeout(() => project.setOpen(toFile(uri), text, uri), 150));
    },

    close(uri: string) {
      texts.delete(uri);
      clearTimeout(timers.get(uri));
      project.close(uri);
    },

    completion({ textDocument, position }: At) {
      const text = texts.get(textDocument.uri);
      if (text === undefined) return [];
      const lines = splitLines(text);
      const opt = optionAt(lines, position.line, position.character);
      if (opt) return optionItems(opt, position.line);
      const ctx = refAt(lines[position.line] ?? '', position.character);
      if (!ctx) return [];
      const range = rangeOf({ line: position.line, ...ctx });
      const item = (label: string, kind: CompletionItemKind, extra: Partial<CompletionItem> = {}): CompletionItem => ({
        label,
        kind,
        textEdit: { range, newText: label + (ctx.close ?? '') },
        ...extra,
      });

      const citeItems = () =>
        bib.entries.map((e) => item(e.key, CompletionItemKind.Value, { detail: [authorYear(e), e.title].filter(Boolean).join(' · '), filterText: `${e.key} ${e.author ?? ''} ${e.title ?? ''}` }));
      const labelItem = (t: Target) =>
        item(t.identifier, kindIcon(t.kind), {
          labelDetails: { description: title(t) }, // shown on every row, unlike `detail`
          detail: `${title(t)} · ${t.file}`,
          documentation: markdown(preview(t)), // `detail` already says what and where it is
          filterText: `${t.identifier} ${t.text}`,
        });

      switch (ctx.trigger) {
        case 'cite':
          return citeItems();
        case 'at':
          return [...citeItems(), ...project.targets().map(labelItem)];
        case 'ref':
        case 'numref':
        case 'eq':
        case 'link-hash':
          return project
            .targets()
            .filter((t) => (ctx.trigger === 'numref' ? t.enumerator : ctx.trigger === 'eq' ? t.kind === 'equation' : true))
            .map(labelItem);
        case 'term':
          return project
            .targets()
            .filter((t) => t.kind === 'term')
            .map((t) => item(t.text, kindIcon(t.kind), { detail: t.file, documentation: markdown(preview(t)) }));
        case 'doc':
        case 'link-path':
        case 'path': {
          // mystmd resolves `{doc}`, `[](path)` and directive file arguments relative to the current file. Directives take any file.
          const here = dirname(pathOf(textDocument.uri));
          return workspaceFiles(root, ctx.trigger === 'path' ? /./ : undefined).map((f) => item(relative(here, f), CompletionItemKind.File));
        }
        case 'xref-key':
          // Clients sort by `sortText` (else label), so list every project key before any of its pages.
          return Object.entries(xrefs).flatMap(([key, p]) => [
            item(key, CompletionItemKind.Module, { detail: p.url, sortText: `0${key}` }),
            ...(p.entries ?? []).filter((e) => e.kind === 'page' && e.page !== '/').map((e) => item(key + e.page, CompletionItemKind.File, { detail: e.url, sortText: `1${key}${e.page}` })),
          ]);
        case 'xref-target': {
          const { key, page } = splitXref(ctx.key!);
          const q = ctx.prefix.toLowerCase();
          const has = (e: XrefEntry) => e.name && (page ? e.page === page : !e.implicit);
          const all = (xrefs[key]?.entries ?? []).filter((e) => has(e) && `${e.name} ${e.title ?? ''}`.toLowerCase().includes(q));
          const matches = [...all.filter((e) => e.name.toLowerCase().startsWith(q)), ...all.filter((e) => !e.name.toLowerCase().startsWith(q))];
          // Sphinx inventories can have tens of thousands of entries: send the best 200 and ask the client to re-query as the user types.
          const items = matches.slice(0, 200).map((e) => item(e.name, kindIcon(e.kind), { labelDetails: { description: e.kind }, detail: e.title && e.title !== e.name ? `${e.title} · ${e.kind}` : e.kind, documentation: e.url, filterText: `${e.name} ${e.title ?? ''}` }));
          return { isIncomplete: matches.length > 200, items };
        }
        case 'directive':
          return [...directiveSpecs].map(([n, d]) => item(n, CompletionItemKind.Keyword, { documentation: markdown(specDoc(d)) }));
        case 'role':
          return [...roleSpecs].map(([n, r]) => item(n, CompletionItemKind.Function, { documentation: markdown(specDoc(r)) }));
        case 'slash': {
          // Templates for every directive (at the start of a line) and role, with common ones listed first.
          const template = (name: string, kind: CompletionItemKind, newText: string, doc: string) =>
            item(name, kind, { detail: kind === CompletionItemKind.Keyword ? 'directive' : 'role', filterText: `/${name}`, sortText: `${common.has(name) ? 0 : 1}${name}`, insertTextFormat: InsertTextFormat.Snippet, textEdit: { range, newText }, documentation: markdown(doc) });
          const atLineStart = !lines[position.line].slice(0, ctx.start).trim();
          const blocks = atLineStart ? [...directiveSpecs].map(([n, d]) => template(n, CompletionItemKind.Keyword, `:::{${n}}${d.arg ? ' $1' : ''}\n${d.body ? '$0\n' : ''}:::`, specDoc(d))) : [];
          return [...blocks, ...[...roleSpecs].map(([n, r]) => template(n, CompletionItemKind.Function, `{${n}}\`$0\``, specDoc(r)))];
        }
      }
    },

    hover(at: At) {
      const ref = refAtCursor(at);
      if (!ref) return specHover(at);
      const r = resolveRef(ref, at.textDocument.uri);
      const value =
        r.kind === 'xref' ? `**${r.entry.title || r.entry.name || r.entry.page || r.entry.url}** · ${r.entry.kind}\n\n${r.entry.url}`
        : r.kind === 'citation' ? `**${authorYear(r.entry) || r.entry.key}** · ${relative(root, r.entry.file)}\n\n${r.entry.title ?? ''}`
        : r.kind === 'label' ? `**${title(r.target)}** · ${r.target.file}\n\n${preview(r.target)}`
        : undefined;
      return value ? { contents: { kind: 'markdown' as const, value } } : null;
    },

    definition(at: At) {
      const ref = refAtCursor(at);
      const r = ref && resolveRef(ref, at.textDocument.uri);
      if (r?.kind === 'file') return point(toUri(r.path), 0);
      if (r?.kind === 'citation') return point(toUri(r.entry.file), r.entry.line);
      return r?.kind === 'label' ? locationOf(r.target) : null;
    },

    references(at: At & { context: { includeDeclaration: boolean } }) {
      const t = labelAtCursor(at)?.target;
      if (!t) return null;
      const refs = labelRefs(t.identifier, true);
      return at.context.includeDeclaration ? [definitionOf(t) ?? locationOf(t), ...refs] : refs;
    },

    // Only labels whose definition we can find in the source can be renamed: not implicit heading labels, closed notebooks, citations or xrefs.
    prepareRename(at: At) {
      const hit = labelAtCursor(at);
      return hit && definitionOf(hit.target) ? hit.range : null;
    },

    rename(at: At & { newName: string }) {
      const hit = labelAtCursor(at);
      const def = hit && definitionOf(hit.target);
      if (!def) return null;
      if (!new RegExp(`^[${labelChars}]+$`).test(at.newName)) throw new ResponseError(ErrorCodes.InvalidParams, `\`${at.newName}\` isn't a valid label`);
      const changes: Record<string, TextEdit[]> = {};
      for (const { uri, range } of [def, ...labelRefs(hit.target.identifier)]) (changes[uri] ??= []).push({ range, newText: at.newName });
      return { changes };
    },

    /** Before files or folders move, update the `{doc}` roles, Markdown links and directive file arguments that point to them or are in them, in the files rename edits. */
    willRenameFiles({ files }: { files: { oldUri: string; newUri: string }[] }) {
      // Where `path` will be after the move. A file in a moved folder moves too, and an extensionless `{doc}` target moves with its file.
      const moved = (path: string) => {
        for (const f of files) {
          const [from, to] = [pathOf(f.oldUri), pathOf(f.newUri)];
          if (path === from || path.startsWith(from + sep)) return to + path.slice(from.length);
          if (path === from.replace(/\.\w+$/, '')) return to.replace(/\.\w+$/, '');
        }
        return path;
      };
      const changes: Record<string, TextEdit[]> = {};
      for (const [uri, text] of projectDocs(false)) {
        for (const ref of refsInText(text).filter(isFile)) {
          // A link's target leaves out its `#fragment`, so the edit keeps it.
          const file = fileOf(uri, ref.target);
          const to = moved(file);
          // Relative to where the referencing file will be, so a moved file's relative links still work.
          const here = pathOf(uri);
          const newText = ref.target.startsWith('/') ? `/${relative(root, to)}` : relative(dirname(moved(here)), to);
          if ((to !== file || moved(here) !== here) && newText !== ref.target) (changes[uri] ??= []).push({ range: rangeOf(ref), newText });
        }
      }
      return { changes };
    },

    inlayHints({ textDocument }: { textDocument: { uri: string } }) {
      return resolvedRefs(textDocument.uri).flatMap(([ref, r]) => {
        // An xref link without text renders with the remote title, so show that. A `{term}` already shows its term.
        const label = r.kind === 'label' ? r.target.kind !== 'term' && hint(r.target) : r.kind === 'xref' && !ref.text && r.entry.title;
        return label ? [{ position: { line: ref.line, character: ref.after }, label, paddingLeft: true }] : [];
      });
    },

    semanticTokens({ textDocument }: { textDocument: { uri: string } }) {
      const builder = new SemanticTokensBuilder();
      for (const [ref, r] of resolvedRefs(textDocument.uri)) {
        if (isFile(ref)) continue; // a file path, not a label
        const kind = r.kind === 'label' ? r.target.kind : r.kind === 'xref' ? r.entry.kind : r.kind === 'citation' ? 'citation' : '';
        const i = semanticTokensLegend.tokenModifiers.indexOf(kind);
        builder.push(ref.line, ref.start, ref.end - ref.start, 0, i < 0 ? 0 : 1 << i);
      }
      return builder.build();
    },

    documentLinks({ textDocument }: { textDocument: { uri: string } }) {
      return resolvedRefs(textDocument.uri).flatMap(([ref, r]) => {
        const target = r.kind === 'file' ? toUri(r.path) : r.kind === 'xref' ? r.entry.url : undefined;
        return target ? [{ range: rangeOf(ref), target }] : [];
      });
    },

    // Labels as workspace symbols, matched by label or text, exact matches first (clients find a label's definition with this).
    workspaceSymbols({ query }: { query: string }) {
      const q = query.toLowerCase();
      const matches = project.targets().filter((t) => `${t.identifier} ${t.text}`.toLowerCase().includes(q));
      matches.sort((a, b) => Number(b.identifier.toLowerCase() === q) - Number(a.identifier.toLowerCase() === q));
      return matches.map((t) => ({ name: t.identifier, kind: SymbolKind.Key, containerName: hint(t), location: locationOf(t) }));
    },

    // The page outline: headings nested by level, with labeled blocks (e.g. "Figure 1 · caption") under their section.
    // A heading's range runs to the next heading at its level or above, so clients can show the section the cursor is in.
    documentSymbols({ textDocument }: { textDocument: { uri: string } }) {
      const text = texts.get(textDocument.uri);
      if (text === undefined) return [];
      const lines = splitLines(text);
      const endOf = (line: number) => ({ line, character: lines[line]?.length ?? 0 });
      const top: DocumentSymbol[] = [];
      const open: { depth: number; children: DocumentSymbol[]; symbol?: DocumentSymbol }[] = [{ depth: 0, children: top }];
      const close = (line: number) => { const { symbol } = open.pop()!; if (symbol) symbol.range.end = endOf(line); };
      for (const t of project.targets().filter((t) => inDocument(t, textDocument.uri))) {
        const at = () => ({ line: t.line - 1, character: 0 });
        const children: DocumentSymbol[] = [];
        const symbol: DocumentSymbol = {
          name: t.depth ? t.text : t.text ? `${title(t)} · ${t.text}` : title(t),
          detail: t.depth ? undefined : t.identifier,
          kind: t.depth ? SymbolKind.String : SymbolKind.Key,
          range: { start: at(), end: at() },
          selectionRange: { start: at(), end: at() },
          children,
        };
        if (t.depth) while (open.at(-1)!.depth >= t.depth) close(t.line - 2);
        open.at(-1)!.children.push(symbol);
        if (t.depth) open.push({ depth: t.depth, children, symbol });
      }
      while (open.length > 1) close(lines.length - 1);
      return top;
    },

    /** A document's problems, by default an open one's. Files on disk only get mystmd's own warnings once they're open. */
    diagnostics(uri: string, text = texts.get(uri) ?? ''): Diagnostic[] {
      const problems = resolvedRefs(uri, text).flatMap(([ref, r]) => (r.kind === 'missing' && r.problem ? [{ severity: DiagnosticSeverity.Warning, range: rangeOf(ref), message: r.problem, source: 'myst' }] : []));
      const lines = splitLines(text);
      // Labels in this file that are defined more than once in the project. Like mystmd, not implicit heading labels.
      const explicit = project.loaded ? project.targets().filter((t) => !t.implicit) : [];
      const duplicates = explicit.filter((t) => inDocument(t, uri)).flatMap((t) => {
        const others = explicit.filter((o) => o !== t && o.identifier === t.identifier);
        if (!others.length) return [];
        const range = definitionOf(t, uri)?.range ?? rangeOf({ line: t.line - 1, start: 0, end: (lines[t.line - 1] ?? '').length });
        const message = `Duplicate label \`${t.identifier}\`, also defined in ${[...new Set(others.map((o) => o.file))].join(', ')}`;
        return [{ severity: DiagnosticSeverity.Warning, range, message, source: 'myst' }];
      });
      // mystmd's own warnings from parsing this page, except the ones we check project-wide above: references (including the citations parse.ts can't link) and duplicate labels.
      // Invalid frontmatter is skipped too, since half-typed YAML is normal while editing.
      const skip = ['reference-target-resolves', 'identifier-is-unique', 'frontmatter-is-yaml', ...(plugins ? ['directive-known', 'role-known'] : [])];
      const mystmd = project.messages(uri).filter((m) => !skip.includes(String(m.ruleId))).map((m) => {
        const line = (m.line ?? 1) - 1;
        const range = { start: { line, character: (m.column ?? 1) - 1 }, end: { line, character: lines[line]?.length ?? 0 } };
        return { severity: m.fatal ? DiagnosticSeverity.Error : DiagnosticSeverity.Warning, range, message: m.reason, source: 'myst' };
      });
      return [...problems, ...duplicates, ...mystmd];
    },

    /** Every document in `projectDocs`, including notebook cells, with its problems. */
    workspaceDiagnostics() {
      return { items: projectDocs(true).map(([uri, text]) => ({ kind: 'full' as const, uri, version: null, items: service.diagnostics(uri, text) })) };
    },
  };
  return service;
}
