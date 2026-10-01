---
title: Directives, roles and files
---

```{figure} images/logo.svg
:label: fig-again
:width: 80px

The same logo again.
```

:::{tip} Try this: names and options
- On a new line type ```` ```{ ```` and you get every directive. Type `:::{` for the colon form.
- Inside any text, type `{` and you get every role.
- In the figure above, add a new line directly under `:width: 80px` and type `:`. You get the figure's other options (`align`, `alt`, ...), without `label` and `width`, which are set.
:::

:::{tip} Try this: hover docs
Hover over `figure` in the directive above, over `:width:`, and over `ref` in {ref}`fig-again`.
You get the documentation straight from mystmd.
:::

:::{tip} Try this: files
- In the figure's argument (`images/logo.svg`), delete the text and ask for completion. You get the project's files, relative to this one.
- Cmd-click `images/logo.svg` to open it.
- Change it to `images/nope.svg`. You get a "File not found" warning. Put it back.
- In running text, type `` {doc}` `` and pick `1-references.md`. Links to other pages work like this: {doc}`1-references.md`
:::
