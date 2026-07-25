#!/usr/bin/env node

/\*\*

- skills/README.md — Iris UI Skills system
-
- Skills are domain-specific automation scripts, analogous to snaplink's
- docs/skills/. Each skill is a directory under skills/<name>/ with a run.mjs
- entry point. They are invoked via:
-
- node cli.mjs skill <name> [args...]
-
- Skills can perform ad-hoc automation (file splitting, refactoring, analysis)
- that doesn't fit into the deterministic check gates.
-
- To add a new skill:
- 1.  mkdir skills/<name>
- 2.  Create run.mjs that exports `async function run(args)`
- 3.  Return 0 for success, non-zero for failure
      \*/

export const description = 'Iris UI Skills system — domain-specific automation scripts'
