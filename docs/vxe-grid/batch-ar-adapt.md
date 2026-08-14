Done. All work committed as `212e8f71`.

## Report

**Commit:** `212e8f71` — `feat(table): grid 批 AR——迷你图表预览 chartPreview（iris 独有）`

### Files changed (14, +853/−6)

**Core (framework-free, additive):**

- `packages/core/src/chart-data.ts` **(new)** — `buildChartData(rows, key)` → `{ points, min, max }`: null/undefined/non-finite → gap points; domain over finite values only; empty/all-gap → `{0,1}`; flat series padded by `|min| || 1` (plugin-charts `dataDomain` parity, never a zero span). Pure `{rows, key}` reader; zero framework imports.
- `packages/core/src/index.ts` — barrel export `buildChartData`/`ChartData`.
- `packages/core/src/i18n.ts` — en `table.chart` / `table.chart.bar` / `table.chart.line`.
- `packages/plugin-locale-zh/src/core/index.ts` — zh `迷你图表/柱状/折线`.

**React (bridge only):**

- `packages/react/src/primitives/table/props.ts` — `chartPreview?: boolean` (single line, full JSDoc captured by manifest scanner).
- `packages/react/src/primitives/table/Table.tsx` — toolbar gate admits `chartPreview`; `data-iris-chart-trigger` (▤) after the zoom toggle; numeric-column memo (the two existing signals: `typeof getCellValue(row,col) === 'number'` **or** `col.summary === 'sum'`); panel render near the distribution panel.
- `packages/react/src/primitives/table/ChartPanel.tsx` **(new)** — `data-iris-chart-panel`: IrisSelect over numeric leaf columns + bar/line toggle; SVG `viewBox 0 0 300 120` **pure structured JSX** (zero SVG strings, zero `dangerouslySetInnerHTML`); bars `fill="var(--iris-primary)"` (zero-baseline for negatives), line = segmented polylines + circles (nulls break the line); first-20 cap + "共 N 行" via `table.total`; Esc/outside/scroll close (batch-edit-panel precedent — the portaled select listbox is excluded so option presses select, not close).

**Tests (both ≤500 lines):**

- `packages/core/src/chart-data.test.ts` — 10 tests: order/domain, empty, nulls→gaps, all-null, non-finite, negatives, single-value padding, flat/zero-flat padding, numeric strings, scaling bounds.
- `packages/react/src/primitives/table/chart-preview.test.tsx` — 12 tests: trigger renders with prop, inert without, panel opens, select lists numeric columns (number-rows + `summary:'sum'`), bar rect count matches, null gaps (no bar/dot, line segments), kind toggle bar↔line, portaled-option selection keeps panel open + recharts, 20-cap + truncated note, Escape/outside close, dataIndex indirection.

**Generated/docs:** `manifest.json`/`llms.txt` (regenerated, `chartPreview` prop, propCount 134→135), `docs/vxe-grid-comparison.md` (iris 独有 table row + 构建状态 + batch row + test counts), `DECISIONS.md`/`batch-ar-baseline.md` (stage bookkeeping).

### Verification (all green)

- core test: **1364 passed** (+10)
- react typecheck: clean
- react test: **1992 passed** (+12)
- react lint: **0 errors** (1 pre-existing IrisTable complexity warning)
- iris-ui-spec `--mode all`: **0 violations**
- `gen:manifest` regenerated + committed; `check:manifest` + `check:docs-reference` pass; prettier clean on all touched files

### What's left

- vue/solid/svelte wiring for `chartPreview` (core material ready; one prop + bridge per adapter, same as prior iris-only batches)
- Full-repo gate (`turbo run test typecheck lint build`, browser E2E, size) per the workflow's review/gate stages
- Budget warnings (12 files vs 5 target, 466 core lines vs 300) are advisory — the file set matches the baseline's own file map (core+i18n+zh+manifest fan-out); same class as batch AJ/AQ noted as non-blocking
