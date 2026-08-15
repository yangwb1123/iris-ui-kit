Baseline complete. Deliverable: **`/home/u1/iris-ui/docs/vxe-grid/batch-bi-baseline.md`** (39 lines) — the only file created (`git status` confirms the pre-existing BH-stage `M`/`??` entries untouched; zero source files modified).

## What's in the baseline

**Exact design** (every anchor verified against current code):

- **Prop** — `sparkline?: boolean` on `IrisTableColumn` (types.ts after `exportRaw` :316, before `filterable` :319 — display-chain prop family). Series per body cell = this column's values over `filteredData[0..i]` **inclusive** (current value is the final point — fiat), read through the `getCellValue` choke point (:827) so `dataIndex`/formula columns work for free; `null`/non-finite → gap, `Number` coercion — buildChartData parity.
- **Core (DRY)** — extract `chartDomain(points)` from `buildChartData` (chart-data.ts :43-78, byte-identical; existing 9 tests = regression net); react reuses it for per-prefix domains (flat/empty padded, never divide-by-zero).
- **Render** — per-cell gate `typeof raw === 'number' && Number.isFinite(raw)`; branch in the body cell arrow (:5722/:5758) after editing, before `col.render` — sparkline wins over render/html/link/formatter/raw (documented fiat); non-numeric columns render **zero** SVG. SVG 20×8, pure structured JSX (no innerHTML), `data-iris-sparkline`, `role="img"` + `aria-label`=series, `pointerEvents: none`; polyline segments on gaps, stroke `var(--iris-primary)` strokeWidth 1.5 (token — ChartPanel precedent); single-point prefix → circle dot.
- **Title** — `cellTitle` (:5199) gains `sparkTitle` before `cellTooltip`: editing exempt → note → compare → series (`"10, 4, 8"`) → tooltipConfig.
- **Cost** — one O(n) render memo (`sparklineData` near :3890, row-identity indexOf + per-column values) + O(i) slice per visible cell; O(n²) worst-case documented as accepted, virtual scroll bounds it; window cap is a deliberate non-goal.
- **7 fiats** for gate arbitration: inclusive prefix · per-cell numeric gate · sparkline wins display chain, mask inert · title precedence · display-only (copy/export/summary/edit untouched) · per-prefix domain via core `chartDomain` · series follows `filteredData` (tree/group-collapse don't truncate).

**File map**: 4 source + 2 test files — core `chart-data.ts` + `chart-data.test.ts` (+5) + react `types.ts` + `Table.tsx` (4 sites) + **NEW** `sparkline.test.tsx`; docs `vxe-grid-comparison.md` (批 BI row + 构建状态); manifest byte-identical (column field — `locked`/`preset` precedent, propCount stays 152); no i18n; vue/solid/svelte zero.

**Test plan**: 11 cases — renders polyline (mandatory), non-numeric column ignored (mandatory), mixed-column null cell fallback, title/aria-label series, gap segments, single-point dot, dataIndex indirection, formula column, filter/sort order, editing coexistence, token color + export-raw inertness.
