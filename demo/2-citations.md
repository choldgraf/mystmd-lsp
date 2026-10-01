---
title: Citations
---

Citations come from `refs.bib`, which `myst.yml` lists under `project.bibliography`.

Literate programming is an old idea [@knuth1984], and notebooks are a recent form of it [@perez2007].
Several at once: [@knuth1984; @lamport1994].
In a role: {cite:p}`knuth1984` and {cite:t}`perez2007`.

:::{tip} Try this
- Delete `knuth1984` from the first line and type `@`. You get the citations, with author, year and title, and the project's labels.
- Type `` {cite}` `` and pick a key.
- Hover over `@perez2007`: you get "Perez et al. 2007" and the title.
- Cmd-click `@lamport1994`: you jump to its entry in `refs.bib`.
- Type `@nobody2020` anywhere. After a moment you get a warning, since no such citation or label exists.
:::

An `@key` that isn't a citation is read as a label instead, as in mystmd: @fig-logo.
