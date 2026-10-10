---
title: References and labels
---

(sec-intro)=
## Things to point at

Labels give you something to point at.
This page defines a figure, a table, an equation, and this heading.

```{figure} images/logo.svg
:label: fig-logo
:width: 120px

The MyST logo.
```

```{table} Results by group
:label: tbl-results

| Group | Score |
|-------|-------|
| A     | 1     |
| B     | 2     |
```

$$
E = mc^2
$$ (eq-energy)

(sec-using)=
## Using them

See {numref}`fig-logo`, {ref}`tbl-results`, {eq}`eq-energy`, and [the intro](#sec-intro).

:::{tip} Try this: completion
Below, delete the text between the backticks, then type a backtick and pick from the list:
- `{ref}` offers every label in the project, with its kind and file.
- `{numref}` offers only numbered things (figures, tables, equations).
- `{eq}` offers only equations.
- `[](#` and `@` also offer labels.
- Each entry has an icon for its type (figures, tables, equations and sections differ), and the type on the right.

Here is a line to edit: {ref}`fig-logo`
:::

:::{tip} Try this: hover, hints and go to definition
- Hover over `fig-logo` in the line above: you get "Figure 1" and its caption.
- Look for the grey hint after each reference above (`Figure 1`, `Table 1`, `(1)`).
- Cmd-click `tbl-results` to jump to the table.
:::

:::{tip} Try this: find references and rename
1. Put the cursor on `fig-logo` in the paragraph above (or on `:label: fig-logo` in the figure).
2. Press Shift+F12 to see every reference, across pages.
3. Press F2 and rename it to `fig-brand`. The figure's label and every reference change together, including the ones in other files.
:::

:::{tip} Try this: outline and symbols
Cmd+Shift+O shows this page's outline, with the figure, table and equation under their section.
Cmd+T searches every label in the project.
:::

## Glossary terms

:::{glossary}
Language server
: A program that gives editors completion, hover and warnings for a language.

Inlay hint
: Grey text the editor shows after a reference, saying what it points to.
:::

A {term}`language server` adds {term}`hints <Inlay hint>` to your editor.

:::{tip} Try this: glossary terms
- Hover over `language server` above to see its definition.
- Inside `` {term}` `` you get completion of the glossary's terms.
- Change a term to one that isn't in the glossary to get a warning.
:::
