---
title: Warnings
---

Everything on this page is wrong on purpose, so you should see a warning on each.
Fix one and its warning goes away.

- An unknown label: {ref}`no-such-label`.
- A missing file:

  ```{figure} images/missing.svg
  A figure whose file doesn't exist.
  ```

- A citation that isn't in `refs.bib`: [@nobody2020].
- A project that isn't in `project.references`: [](xref:nowhere#thing).
- A label that is also defined on [another page](1-references.md):

(sec-using)=
## Duplicate label

:::{tip} Try this
Hover over each squiggle for the message.
The duplicate label is flagged on both pages.
Rename this one to `sec-warnings`, and the warnings on both pages clear.
:::
