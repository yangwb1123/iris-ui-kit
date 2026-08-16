Baseline written to `/home/u1/iris-ui/docs/vxe-grid/batch-cr-baseline.md` (94 lines). No source files touched — `git status` shows only the new baseline plus the pre-existing prior-stage dirt (`DECISIONS.md`, `batch-cq-gate.md`), HEAD `2be104fe` unchanged.

**Key findings from the current IrisTable:**

- **The footer summary row (Table.tsx:8348) is the exact pipeline to reuse**: `op = col.summary` → `aggregate(rows, (r) => getCellValue(r, col), op)` → `aggregateAccuracy` gate (batch P's single rounding point) → `col.renderSummary ?? String(value)`, aggregated over **`bodyData`** (:8557). 列汇总条 mirrors this byte-for-byte → footer-parity is directly testable.
- **Zero new imports**: `aggregate` already imported (:3), `getCellValue` (:1581) is the module-level formula choke point (batch AO).
- **Sibling-bar placement precedent**: toolbar fragment (gate :8681, closes :9446) → FNR bar (:9448) → root (`data-iris-table` :9562). The bar inserts right after the toolbar close — spec-literal "工具栏下方横条" — chaining borders like every bar in the stack; column alignment is free via the shared `gridTemplateColumns` memo (:5998).

**Design** — `columnTotals?: boolean` (props.ts after `editPreview`:448, propCount 177→178, fail-closed off): full-width grid bar (`data-iris-column-totals`, `COLUMN_TOTALS_STYLE` in styles.ts — token-only, FNR-bar border language); one cell per leaf column (non-sum columns render empty placeholders to keep track alignment; `data-iris-column-totals-cell={col.key}`); only `summary === 'sum'` columns get values over `bodyData` with the exact summary-row value pipeline; `columnTotalsValues` useMemo (chartNumericColumns precedent), zero new state; bar gate independent of toolbar visibility (FNR precedent). Five explicit fiats: no label/i18n, fixed-track alignment same as batch M, no column virtualization, no pinned sticky, empty body → bar renders with `0`.

**File map** — props.ts · styles.ts · Table.tsx (4 touch points: destructure :2454 / memo / JSX fragment :9446 / nothing else) · NEW `column-totals.test.tsx` · comparison-doc row + `pnpm gen:manifest` regen (177→178, eventCount 31 unchanged, core 1559 untouched, react-only).

**Test plan** — react +12 (2570→2582): fail-closed default, bar render position, sum correctness (3×[10,20,30]→60), sum-only gating, aggregate null/non-finite semantics, formula-column funnel, aggregateAccuracy rounding + out-of-range ignore, **footer parity** (bar cell === summary cell), empty-data `0` + live update, selection-track spacer, no-toolbar independence, token-style contract.
