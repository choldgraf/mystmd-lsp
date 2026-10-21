---
title: External references
---

`myst.yml` lists two other sites under `project.references`.
`myst` is the MyST guide, which is a MyST site.
`python` is the Python docs, which is a Sphinx site.
When the project loads, the server downloads each site's inventory, which lists the targets you can link to.
So this page needs network access.

A link to a page in the MyST guide: [](xref:myst/quickstart).
A link to a figure in it: [](xref:myst/quickstart#frontmatter-before).
A Python class: [](xref:python#pathlib.Path).

:::{tip} Try this
- Delete the text after `xref:` in a link above and type it again.
  You get the keys (`myst`, `python`), then pages (`myst/quickstart`), then targets after `#`.
- Hover over a link to see the URL it points to.
- A link with no text shows the remote title after it in grey.
- Cmd-click a link to open it in your browser.
- Change `python` to `pythno`.
  You get a warning that the project isn't in `project.references`.
:::

