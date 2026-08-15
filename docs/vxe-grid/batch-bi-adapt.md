Done. Batch BI (列 sparkline) is complete and all gates pass.

## Summary

**Commit**: `feat(table): grid 批 BI——列 sparkline（iris 独有）` (+ adapt report)

### Files changed (4 source + 2 test, ≤4 source constraint met)

| File                                            | Change                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| ----------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/core/src/chart-data.ts`               | New exported `chartDomain(points)` — the domain half of `buildChartData` extracted verbatim (finite-only min/max; empty/all-gap → `{0,1}`; flat padded by `\|min\| \|\| 1` — never a zero span). `buildChartData` now delegates to it (byte-identical behavior; existing 9 tests = regression net)                                                                                                                                                       |
| `packages/core/src/index.ts`                    | barrel: `export { buildChartData, chartDomain, type ChartData }` (named export — scanner hygiene)                                                                                                                                                                                                                                                                                                                                                        |
| `packages/react/src/primitives/table/types.ts`  | `sparkline?: boolean` on `IrisTableColumn` after `exportRaw` (single-line prop — scanner hygiene)                                                                                                                                                                                                                                                                                                                                                        |
| `packages/react/src/primitives/table/Table.tsx` | 4 sites: 8 module helpers (`SparklineData` interface, `sparkX/Y`, `sparkSegments`, `sparklineSeries`, `sparklineCell`, `renderSparkline` — cell arrow complexity stays ≤70); `sparklineData` O(n) memo (row-identity index + per-column raw values over `filteredData`); `sparkTitle` in the `cellTitle` chain (editing→note→compare→series→tooltip); body-cell branch after editing, before `col.render` — sparkline wins the display chain, mask inert |
| `test/sparkline.test.tsx` (new)                 | 13 tests, 205 lines (≤500)                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `test/chart-data.test.ts` (core)                | +5 `chartDomain` tests (170 lines total, ≤500)                                                                                                                                                                                                                                                                                                                                                                                                           |
| `docs/vxe-grid-comparison.md`                   | iris 独有 capability row + 构建状态 line + test-count line (BG/BH precedent — big table stops at 批 BF)                                                                                                                                                                                                                                                                                                                                                  |
| `packages/manifest/*`                           | regenerated via `gen:manifest` — **byte-identical** (column fields aren't manifest-visible, `locked`/`preset` precedent; propCount stays 152)                                                                                                                                                                                                                                                                                                            |

### Verification (all pass, exact commands)

- core test: **1474/1474** (95 files, +5 chartDomain) · core typecheck clean · core lint 0 errors (7 pre-existing warnings, identical to HEAD)
- react typecheck clean · react test **2176/2176** (193 files, +13 sparkline) · react lint **0 errors** (1 pre-existing IrisTable complexity warning)
- spec `--mode all --json`: **0 violations** (1414 files, exit 0)
- `gen:manifest` regenerated (up to date, no diff) · `check:manifest` + `check:docs-reference` clean

### Fiats honored

Inclusive prefix `filteredData[0..i]` (current value = final point) · per-cell numeric gate (`typeof raw === 'number'` + finite; numeric strings / null cells render zero SVG) · sparkline wins over render/html/link/formatter/raw, mask inert · title precedence editing→note→compare→series→tooltip · display-only (copy/export/summary/edit untouched) · per-prefix domain via core `chartDomain` (never divide-by-zero) · series follows `filteredData` (sort/filter trim; tree/group-collapse don't truncate) · `role="img"` + aria-label = series, `pointerEvents: none`, stroke `var(--iris-primary)` 1.5 (token only, zero innerHTML).

### Left

- vue/solid/svelte untouched (react-only bridge, per baseline — no sparkline concept exists in those adapters)
- No zoom/scale option for the sparkline (20×8 fixed, per baseline design)
- O(n²) worst case documented and accepted (virtual scroll bounds the visible window; window cap is a deliberate non-goal)
