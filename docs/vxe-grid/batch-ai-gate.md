## Gate complete — PASS

The review verdict was **FAIL** with one confirmed blocker; I applied the fix, reran the full gate, and committed.

### Fix (review blocker #1, medium)

`packages/react/src/primitives/table/Table.tsx` — the `querySort` memo now steps aside when the effective sort state is non-null (`sort !== null` guard + dep added). Since `sortProp !== undefined` already covered controlled mode, this closes the missing uncontrolled path: a header click (`cycleSort` → internal `useTableSort` state) now takes over from the `sort by` clause — last-user-action-wins. The `remoteSort` / parent-prop guards are unchanged.

**Regression test** added to `query-input.test.tsx`: seeds `sort by name asc` (Alice first), clicks the Age header, asserts age-asc order (Charlie → Bob → Alice) — exactly the reviewer's empirical check.

Review finding #2 (parser leniency on dangling conjunctions) was intentionally left as-is: additive-only scope, fail-closed parser, no correctness impact.

### Full gate results

- `turbo run test typecheck lint build --concurrency=2` → **180/180 tasks** (5m11s)
- `pnpm audit` → **0 vulnerabilities**
- `gen:manifest` + `check:manifest` → **155×4 frameworks, 86 tokens, up-to-date, no diff**

### Final test counts

- **vitest total: 7664 passed, 0 failed** — react **1884** (query-input 7/7 incl. new takeover test, table 83/83), core 1291, vue 1531, solid 974+34 hydration, svelte 916+31 hydration, plugins/tools 563
- SSR node:test 8 (next 2 · nuxt 2 · solidstart 2 · sveltekit 2); desktop go: tauri 2 + wails ok

### Commits

- **`7d8f5b42`** — `feat(table): grid 批 AI——自然语言查询（iris AI 原生定位）` (5 files, +87/−67)
- `f65b5e8a` — `chore: 批 AI 收尾（gate 报告）` (gate report at `docs/vxe-grid/batch-ai-gate.md`)

Working tree clean.
