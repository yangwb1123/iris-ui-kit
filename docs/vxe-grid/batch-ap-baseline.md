Baseline complete — `/home/u1/iris-ui/docs/vxe-grid/batch-ap-baseline.md` (81 lines). `git status` confirms only the new doc; zero source files touched.

**What the baseline covers** (every claim verified against current code):

**a) Selection summary — `selectionSummary?: boolean` (additive, default `false`):**

- Gate: `selectable === 'multi' && displaySelection.length > 0 && selectionSummary === true`; renders in the toolbar flex (`data-iris-table-toolbar`, Table.tsx:5049) immediately **before** the batch button block (Table.tsx:5401).
- Content: `已选 N 行` via new i18n key `table.selectionSummary` (same `{count}` interpolation as the existing header `table.selectedCount`, Table.tsx:5851); `· 合计 X` per leaf column with `summary === 'sum'` — computed with the exact summary-row material: `aggregate(selectedRows, (r) => getCellValue(r, col), 'sum')` (Table.tsx:4731) + the same `aggregateAccuracy` rounding point + `String(value)` formatting; clear button `data-iris-selection-clear` → the shared `clearSelection` path (`rebaseToProp(); selModel.clear()`, Table.tsx:2733).
- Additive gating rationale documented: the header already shows a count, vxe has no parity feature, and it matches the iris-独有 opt-in family (undo/cellRange/fnr).
- Sum rows mapped via `bodyData` (Table.tsx:3029, filtered+sorted+tree-flattened) in bodyData order through `rowKeyOf` (Table.tsx:2535); cross-page proxy keys absent from bodyData skipped (view-bound, same as the summary row).

**b) `handle.exportSelectionCsv(): string`:** same selected-rows mapping → `exportCsv(withComputedFormulaCells(...), viewColumnsRef.current)` — byte-identical shape to `exportCurrentViewCsv` (Table.tsx:2725), formula columns materialized on shadow rows, hidden columns excluded; empty selection → `''` (documented, caller detects via `getSelection()`). Mount-time handle caveat → adds a `bodyDataRef` mirror (F1 regression pattern).

**File map:** 5 edits (props.ts, types.ts, Table.tsx, core i18n.ts, plugin-locale-zh) + 1 new test file (~16 cases) — no new core API (`aggregate` reused from `data-view/aggregate.ts`). 7 numbered fiats for gate arbitration.
