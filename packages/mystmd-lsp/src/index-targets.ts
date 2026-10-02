import type { GenericNode } from 'myst-common';

/**
 * Something a reference can point at. `line` is 1-based, as in mdast positions. `depth` is a heading's level. `implicit` labels are made by mystmd, e.g. from a heading's text.
 * `uri` is the open document it's in, which for a notebook cell isn't its file's URI. `doc` is a glossary term's definition.
 */
export type Target = { identifier: string; kind: string; text: string; enumerator?: string; file: string; line: number; depth?: number; implicit?: boolean; uri?: string; doc?: string };

const targetTypes = new Set(['heading', 'container', 'math', 'code', 'table', 'paragraph', 'image', 'list', 'blockquote', 'proof', 'exercise', 'admonition', 'definitionTerm']);
const kinds: Record<string, string> = { math: 'equation', definitionTerm: 'term' };

/** Collect reference targets from an mdast tree (fast parse or built page JSON). */
export function targetsFromTree(tree: GenericNode, file: string): Target[] {
  const targets: Target[] = [];
  // `next` is the following sibling: a glossary term's definition.
  const walk = (node: GenericNode, next?: GenericNode) => {
    if (node.identifier && targetTypes.has(node.type)) {
      targets.push({
        identifier: node.identifier,
        kind: node.type === 'container' ? node.kind ?? node.type : kinds[node.type] ?? node.type,
        text: textOf(node.type === 'container' ? node.children?.find((c) => c.type === 'caption') : node).slice(0, 60),
        enumerator: node.enumerator,
        file,
        line: lineOf(node) ?? 1,
        depth: node.type === 'heading' ? node.depth : undefined,
        implicit: node.implicit,
        doc: next?.type === 'definitionDescription' ? textOf(next) : undefined,
      });
    }
    node.children?.forEach((c, i, all) => walk(c, all[i + 1]));
  };
  walk(tree);
  return targets;
}

/** Plain text of a node, skipping caption numbers ("Figure 1:"). */
function textOf(node?: GenericNode): string {
  if (!node || node.type === 'captionNumber') return '';
  if (node.type === 'image') return node.alt ?? '';
  if (!node.children) return typeof node.value === 'string' ? node.value : '';
  return node.children.map(textOf).join('').replace(/\s+/g, ' ').trim();
}

// Built page JSON drops positions on directive-generated nodes (e.g. figure containers), so fall back to the first positioned descendant.
function lineOf(node: GenericNode): number | undefined {
  return node.position?.start.line ?? node.children?.map(lineOf).find((l) => l !== undefined);
}
