Gate complete — **PASS**. Tree clean.

## Summary

**Review verdict was FAIL** (one HIGH blocker + 2 LOW + 2 INFO). All applied and the full gate reran green.

### Fixes

- **HIGH — stats crash on data shrink**: the per-column stats memo (`Table.tsx`) now guards `stats[key]` presence — core `rangeStats` returns `{}` when the row span is fully out of bounds after `bodyData` shrinks (e.g. an NL query emptying the view). Columns without stats are dropped; empty result → panel hides while the hoisted `statsOpen` stays true (reappears when the range is valid again). Memo moved after `visibleColSet` (TDZ-safe) and gained the dep.
- **LOW — hidden columns**: same `visibleColSet` skip the cell render uses now applies — virtualized/scrolled-out columns never appear as stats rows.
- **LOW — a11y**: `aria-expanded` reflects actual panel presence (not hoisted open state); `role="table"` panel gained `aria-label` (accessible name).
- **INFO**: empty `''` query no longer captured into view snapshots (batch-AI "empty inactive" convention).
- **INFO**: doc drift `+8 keys` → `+7 keys` in `batch-aj-adapt.md`.
- **Regression test** (`range-stats-view.test.tsx`): select → open 统计 → shrink view below range via controlled query → no crash, panel hides, `aria-expanded="false"`, bar intact, reappears on re-grow.

### Full gate

- `turbo run test typecheck lint build --concurrency=2` → **180/180 tasks** (4m16s)
- `pnpm audit` → **0 vulnerabilities**
- `gen:manifest` + `check:manifest` → **155×4 frameworks, 86 tokens, up-to-date, no diff**

### Final test counts

- **vitest: 7210 passed, 0 failed** — react **1892** (was 1891, +1 regression), core 1300, vue 1531, solid 974+34 (SSR), svelte 916+31 (SSR), plugins/tools/apps 532
- SSR node:test 7 (next 2 · nuxt 2 · solidstart 2 · sveltekit 1); desktop: tauri 2 + wails ok + electron smoke ok

### Commits

- **`996dc8ba`** — `feat(table): grid 批 AJ——区域统计 + 查询视图联动（iris 独有闭环）` (7 files, +192/−21)
- `b70f03c3` — `chore: 批 AJ 收尾（gate 报告）`

Working tree clean. Report at `docs/vxe-grid/batch-aj-gate.md`.
