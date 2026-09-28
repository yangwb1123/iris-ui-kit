---
"@iris-ui-kit/core": patch
"@iris-ui-kit/plugin-admin": patch
"@iris-ui-kit/plugin-locale-zh": patch
"@iris-ui-kit/tokens": patch
"@iris-ui-kit/react": patch
"@iris-ui-kit/vue": patch
"@iris-ui-kit/solid": patch
"@iris-ui-kit/svelte": patch
---

Fix five defects found by running the gates on a real machine, plus wire pbatch
(ai-batch-runner) into the repo.

- `createDataSource` published the loaded rows **twice** on every load:
  `reapplyPendingOptimistic` wrote back the snapshot the caller had just
  published even when no optimistic layer was pending. The duplicate emission
  cost an extra render in all four adapters and defeated React's referential
  bail-out. The optimistic-layer arithmetic now lives in
  `data-source-optimistic.ts` (pure, framework-agnostic) and skips the redundant
  write.
- `plugin-admin`: a client-side delete located its row by object identity
  (`clientRows.indexOf(current)`) while the resource publishes *clones*, so
  `indexOf` was always `-1` and the delete silently removed nothing. Deletion
  now matches on the row key, like the update path already did.
- `@iris-ui-kit/tokens`: add `iris.radius.full` (pill radius). `IrisIconPicker`
  referenced `--iris-radius-full` in all four adapters while no theme defined it.
- `MonthPicker`: the year header was styled in React/Vue but unstyled in
  Solid/Svelte, so the same control rendered at a different size per framework.
- `@iris-ui-kit/plugin-locale-zh`: add the 16 `iconPicker.*` translations that
  `IrisIconPicker` introduced; the "no English fallback" guard was red.

Engineering: `scripts/lib/run-pnpm.mjs` no longer hands pnpm's native binary to
`node` (that produced a `SyntaxError` and a non-zero status indistinguishable
from a real gate failure, breaking `check:manifest`, `check:docs-reference` and
the four SSR production-route suites on macOS); `check-doc-facts --write` now
actually rewrites the counts line it claims to rewrite; `pnpm test:scripts`
covers the launcher and runs in CI.
