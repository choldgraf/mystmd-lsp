---
title: External references
---

`myst.yml` lists two other sites under `project.references`: `myst` (the MyST guide, a MyST site) and `python` (the Python docs, a Sphinx site).
The server downloads each one's inventory when it starts, so this needs network access.

A link to a page in the MyST guide: [](xref:myst/quickstart).
A link to a figure in it: [](xref:myst/quickstart#frontmatter-before).
A Python class: [](xref:).

:::{tip} Try this
- Delete the text after `xref:` in a link above and type it again. You get the keys (`myst`, `python`), then pages (`myst/quickstart`), then targets after `#`.
- Hover over a link to see where it resolves.
- A link with no text, like the Python one, shows the remote title after it in grey.
- Cmd-click a link to open it in your browser.
- Change `python` to `pythno`. You get a warning that the project isn't in `project.references`.
:::
