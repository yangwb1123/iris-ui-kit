Baseline complete — `/home/u1/iris-ui/docs/vxe-grid/batch-ar-baseline.md` (182 lines). `git status` confirms only the new doc; zero source files touched.

**What the baseline covers** (every claim verified against current code):

**a) Core `buildChartData`** — new `packages/core/src/chart-data.ts`:

- Pure function in the exact `value-distribution.ts` / `range-stats.ts` mold: adapter does column mapping, core stays `{ rows, key }`-style pure.
- **SVG convention documented from evidence**: plugin-charts core returns structured geometry (`plotBox`/`dataDomain`/`barRects`/`linePath`) and react/vue/svelte/solid adapters render `<svg>` JSX; `Gauge.tsx` renders `<svg viewBox>` directly. `dangerouslySetInnerHTML` is disallowed for new code — the ONLY existing usage is the documented `html` cell opt-in (Table.tsx:4708, types.ts:206) and `Icon.tsx` strips the prop from its type. So `buildChartData` returns `{ points, min, max }` only; the react adapter does the `(v−min)/(max−min)` pixel mapping and renders `<rect>`/`<polyline>`/`<circle>` — no SVG strings, no escaping class of bugs.
- Domain semantics: empty/all-null → `{0,1}`, flat series padded (never divide by zero — plugin-charts `dataDomain` parity), non-finite dropped (aggregate parity), null = gap.

**b) React `chartPreview?: boolean`**:

- Toolbar gate at Table.tsx:5267 must admit `chartPreview`; trigger `data-iris-chart-trigger` placed after the zoom toggle (Table.tsx:5816), same local-state/glyph pattern as zoom (Table.tsx:2154).
- Panel floats exactly like `TableDistributionPanel` (`useFloating` + `useDismiss` + portal; Esc/outside/scroll close) — verified against DistributionPanel.tsx.
- Numeric detection = the two existing signals: `typeof getCellValue(row, col) === 'number'` (Table.tsx:4567, formula columns flow through the getCellValue choke point at :622) OR `col.summary === 'sum'` (Table.tsx:5638).
- Charts the CURRENT `filteredData` (Table.tsx:3018), 20-row cap mirroring `DISTRIBUTION_TOP`, note reuses existing `table.total` key; axes skipped (fiat); token colors only.

**c) i18n**: `table.chart` / `table.chart.bar` / `table.chart.line` — en in core `defaultMessages` (next to `table.total` :125), zh in `plugin-locale-zh` (:63).

**File map:** 2 new files (core + test, ChartPanel + test) + 6 edits (core index/i18n, zh locale, props, Table.tsx) + 9 numbered fiats for gate arbitration.
