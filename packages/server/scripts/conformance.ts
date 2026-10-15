// Compares the references and label definitions the regexes in src/syntax.ts find with mystmd's parse. See "Conformance" in docs/contributing.md.
import { readdirSync, readFileSync } from 'node:fs';
import { relative } from 'node:path';
import { load } from 'js-yaml';
import { parse } from 'mystmd-client/parse';
import { markdownCells, workspaceFiles } from '../src/service.ts';
import { labelDefinition, refsInText, splitLines } from '../src/syntax.ts';

type Case = { id: string; src: string };
const kinds = ['label role', 'doc role', 'path link', 'label link', 'label definition'];

// Spec examples where the regexes are known to differ from mystmd, and why.
const known = new Set([
  // mystmd accepts spaces in `:label:`, like `:name: My code`, but matching them makes frontmatter `name:` and option text look like definitions on real projects.
  'directives.code.yml: Code directive, starting line',
  'directives.code.yml: Code-block starting line',
]);

/** Each myst-spec example of MyST syntax with its source. The CommonMark examples are left out. */
function specCases(): Case[] {
  const dir = new URL('dist/examples/', import.meta.resolve('myst-spec/package.json'));
  return readdirSync(dir).filter((file) => /^(?:roles|directives|references)\./.test(file)).flatMap((file) =>
    (load(readFileSync(new URL(file, dir), 'utf8')) as { cases: { title: string; myst?: string }[] }).cases.filter((c) => c.myst).map((c) => ({ id: `${file}: ${c.title}`, src: c.myst! })),
  );
}

/** Each Markdown file, and each Markdown cell of a notebook, under `root`. */
function corpusCases(root: string): Case[] {
  return workspaceFiles(root).flatMap((file) => {
    const [id, src] = [relative(root, file), readFileSync(file, 'utf8')];
    return file.endsWith('.md') ? [{ id, src }] : markdownCells(id, src).map(([id, src]) => ({ id, src }));
  });
}

/** What mystmd's parse finds, like `label role fig1`. */
function mystmd(src: string) {
  const found: string[] = [];
  const walk = (node: any, parent?: any) => {
    const role = parent?.type === 'mystRole' ? parent.name : undefined;
    // mystmd keeps the spaces around a role's target in `label`, but drops them when it resolves the reference.
    if (node.type === 'crossReference' && ['ref', 'eq', 'numref'].includes(role)) found.push(`label role ${node.label.trim()}`);
    if (node.type === 'link' && role === 'doc') found.push(`doc role ${node.url}`);
    // The regexes take a local link's or Markdown image's path without its `#fragment`, and leave out URLs.
    // A directive's image has no position, and its path isn't a link.
    if ((node.type === 'link' || (node.type === 'image' && node.position)) && !role && node.url) {
      if (node.url.startsWith('#')) found.push(`label link ${node.url.slice(1)}`);
      else if (!/^\w+:/.test(node.url)) found.push(`path link ${node.url.split('#')[0]}`);
    }
    // An `{index}` directive makes a `mystTarget` without a label.
    if (node.type === 'mystTarget' && node.label) found.push(`label definition ${node.label}`);
    if (node.type === 'mystDirective') for (const o of ['label', 'name']) if (node.options?.[o]) found.push(`label definition ${node.options[o]}`);
    // A `math` directive's label is counted on the directive.
    if (node.type === 'math' && node.label && parent?.type !== 'mystDirective') found.push(`label definition ${node.label}`);
    node.children?.forEach((c: any) => walk(c, node));
  };
  walk(parse(src));
  return found;
}

/** What the regexes find. */
function regexes(src: string) {
  const lines = splitLines(src);
  const refs = refsInText(src).flatMap((r) => {
    if (['ref', 'eq', 'numref'].includes(r.kind)) return [`label role ${r.target}`];
    if (r.kind === 'link') return [`label link ${r.target}`];
    // `doc` is both a {doc} role and a Markdown link to a file. A link's target follows `(`.
    if (r.kind === 'doc') return [`${lines[r.line][r.start - 1] === '(' ? 'path link' : 'doc role'} ${r.target}`];
    return [];
  });
  const defs = lines.flatMap((line) => labelDefinition(line)?.target ?? []).map((t) => `label definition ${t}`);
  return [...refs, ...defs];
}

/** Names in `a` but not in `b`, counting repeats. */
function minus(a: string[], b: string[]) {
  const rest = [...b];
  return a.filter((name) => {
    const i = rest.indexOf(name);
    if (i >= 0) rest.splice(i, 1);
    return i < 0;
  });
}

/** Prints each difference and a table per kind, and returns the ids of the cases that differ. */
function report(title: string, cases: Case[]) {
  console.log(`${title}: - is something mystmd found and the regexes didn't, + the other way round`);
  const counts = Object.fromEntries(kinds.map((k) => [k, { matched: 0, missed: 0, 'false positive': 0 }]));
  const count = (names: string[], status: 'matched' | 'missed' | 'false positive') => names.forEach((n) => counts[kinds.find((k) => n.startsWith(k))!][status]++);
  const differ: string[] = [];
  for (const { id, src } of cases) {
    const expected = mystmd(src);
    const found = regexes(src);
    const missed = minus(expected, found);
    const extra = minus(found, expected);
    count(minus(expected, missed), 'matched');
    count(missed, 'missed');
    count(extra, 'false positive');
    if (!missed.length && !extra.length) continue;
    differ.push(id);
    console.log(`  ${known.has(id) ? 'known ' : ''}${id}: ${[...missed.map((n) => `-${n}`), ...extra.map((n) => `+${n}`)].join(', ')}`);
  }
  console.table(counts);
  return differ;
}

const differ = report('myst-spec', specCases());
const fixed = [...known].filter((id) => !differ.includes(id));
fixed.forEach((id) => console.log(`Known difference no longer differs, remove it from \`known\`: ${id}`));
if (process.env.MYST_CORPUS) report(process.env.MYST_CORPUS, corpusCases(process.env.MYST_CORPUS));
if (fixed.length || differ.some((id) => !known.has(id))) process.exitCode = 1;
