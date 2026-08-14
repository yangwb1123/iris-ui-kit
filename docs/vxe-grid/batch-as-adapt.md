Both commits landed, working tree clean. All gates green. Final verification summary:

## Report — batch AS (autoRefresh + freshness) ✅

**Commits:**

- `8056e75e` — `feat(table): grid 批 AS——自动刷新 autoRefresh + 新鲜度 freshness（iris 独有）` (8 files: 6 source + 1 test file + manifest)
- `59d434b9` — `chore: 批 AS 收尾（adapt 报告 + DECISIONS + 文档）` (4 files)

### Files changed

| File                                            | Change                                                                                                                                                                                                                                |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/core/src/date.ts`                     | `formatClock(date)` — local 24h `HH:MM:SS`, padStart, no Intl                                                                                                                                                                         |
| `packages/core/src/date.test.ts`                | +2 tests (midnight, padding)                                                                                                                                                                                                          |
| `packages/core/src/i18n.ts`                     | en `table.freshness: 'Updated at {time}'`                                                                                                                                                                                             |
| `packages/core/src/index.ts`                    | barrel export `formatClock` (needed for react typecheck vs core dist)                                                                                                                                                                 |
| `packages/plugin-locale-zh/src/core/index.ts`   | zh `更新于 {time}`                                                                                                                                                                                                                    |
| `packages/react/src/primitives/table/props.ts`  | `autoRefresh?: { intervalMs: number }` + `freshness?: boolean` — single-line declarations (manifest-scanner-safe), JSDoc documents loading-flash, proxy-only, ≤0 fail-closed                                                          |
| `packages/react/src/primitives/table/Table.tsx` | interval effect keyed `[hasProxy, intervalMs]`, tick = `proxyRef.current?.refetch()`; freshness state + effect keyed `[freshness, liveData]`; toolbar gate + `data-iris-freshness` stamp (hidden when 0 rows, `--iris-*` tokens only) |
| **NEW** `auto-refresh-freshness.test.tsx`       | 12 tests, 306 lines (≤500)                                                                                                                                                                                                            |
| `packages/manifest/{manifest.json,llms.txt}`    | regenerated, propCount 135→137                                                                                                                                                                                                        |
| `docs/vxe-grid-comparison.md`                   | iris 独有 section +2 rows, 构建状态, batch table, test counts                                                                                                                                                                         |

### Tests added (12)

autoRefresh (7): interval fires refetch · unmount clears · no prop → no timer · intervalMs change restarts · ≤0 fail-closed · loading-flash locked (deferred refetch → loading row until resolve) · non-proxy inert. freshness (5): initial data stamps · edit re-stamps · proxy first-arrival stamps · hidden when no rows · no prop → no element.

### Verification (all green)

- core test: **1366 passed** (+2) · react typecheck: clean · react test: **2005 passed** (+12, 0 regressions) · react lint: **0 errors** (1 pre-existing complexity warning) · `iris-ui-spec.py --mode all`: **0 violations** · `gen:manifest` regenerated + committed; `check:manifest` + `check:docs-reference` pass · prettier clean.

### What is left

- **vue/solid/svelte wiring** for `autoRefresh`/`freshness` (core material ready; out of scope — "react only")
- **File budget**: 8 files in the feat commit vs target ≤5 — matches the baseline's own file map (core+i18n+zh+barrel+props+Table+test+manifest fan-out), advisory per batch AR/AQ precedent
- Full-repo gate (turbo run, E2E, size) per the workflow's review/gate stages
