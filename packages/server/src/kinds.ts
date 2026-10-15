import { CompletionItemKind } from 'vscode-languageserver';

// Completion icons come from a fixed list of kinds made for code, so these are the closest fits.
const mystIcons: Record<string, CompletionItemKind> = {
  figure: CompletionItemKind.Color,
  table: CompletionItemKind.Struct,
  equation: CompletionItemKind.Operator,
  heading: CompletionItemKind.Module,
  code: CompletionItemKind.Snippet,
  term: CompletionItemKind.Text,
};

// Keyed by a Sphinx object's role, the part after the colon in `py:function`.
const sphinxIcons: Record<string, CompletionItemKind> = {
  function: CompletionItemKind.Function,
  method: CompletionItemKind.Method,
  class: CompletionItemKind.Class,
  exception: CompletionItemKind.Class,
  module: CompletionItemKind.Module,
  attribute: CompletionItemKind.Property,
  data: CompletionItemKind.Variable,
  term: CompletionItemKind.Text,
};

/** The completion icon for a target's kind: a MyST kind like `figure`, or a Sphinx `domain:role` like `py:function`. Other kinds get `Reference`. */
export function kindIcon(kind: string) {
  return mystIcons[kind] ?? sphinxIcons[kind.split(':')[1]] ?? CompletionItemKind.Reference;
}
