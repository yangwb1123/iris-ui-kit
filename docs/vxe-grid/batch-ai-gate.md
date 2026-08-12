**Gate complete — PASS** (review was FAIL; the confirmed blocker fixed with a regression test, full gate rerun, committed).

## Review verdict: FAIL → fix applied

| #            | Finding                                                                                                                                                                                                                                                                                                                                                    | Fix                                                                                                                                                                                                                                                                                                                                                                                                                |
| ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1 **MEDIUM** | Sort "last-user-action-wins" documented (baseline, adapt doc, code comment at `Table.tsx:1102-1106`) but not implemented — `querySort` never consulted the internal uncontrolled sort state from `useTableSort` (`sort`), so with `query="sort by name asc"` clicking the Age header left rows name-sorted (Alice first; expected age-asc → Charlie first) | `querySort` memo now steps aside when the effective `sort` state is non-null (`sort !== null` guard + dep), which covers the uncontrolled header-click takeover (`cycleSort` → internal state); the parent-sort-prop (`sortProp !== undefined`) and `remoteSort` guards are unchanged. New regression test in `query-input.test.tsx`: seeds name-asc, clicks Age header, asserts age-asc order (Charlie/Bob/Alice) |
| 2 **LOW**    | Parser leniency: dangling/doubled conjunctions and doubled `in (…)` silently accepted — **not fixed** (out of scope: additive-only, fail-closed parser intentionally tolerates junk clauses; no correctness impact on valid queries; no source change made)                                                                                                | —                                                                                                                                                                                                                                                                                                                                                                                                                  |

## Gate results (all green)

- `turbo run test typecheck lint build --concurrency=2` → **180/180 tasks** (5m11s; 54 cached)
- `pnpm audit` → **0 vulnerabilities**
- `gen:manifest` + `check:manifest` → **155×4 frameworks, 86 tokens, up-to-date, no diff**

## Final test counts

- **vitest total: 7664 passed, 0 failed** — react **1884** (query-input suite 7/7 incl. +1 takeover regression; table suite 83/83), core 1291, vue 1531, solid 974+34 hydration, svelte 916+31 hydration, plugins/tools 563
- SSR node:test 8 (next 2 · nuxt 2 · solidstart 2 · sveltekit 2), desktop go: tauri 2 + wails ok

## Commit

`7d8f5b42` — `feat(table): grid 批 AI——自然语言查询（iris AI 原生定位）` (5 files, +87/−67); gate report lands in the follow-up chore commit; working tree clean.
