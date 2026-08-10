Baseline written to `/home/u1/iris-ui/docs/vxe-grid/batch-i-baseline.md` (292 lines). No source files modified — the only change is the new doc (the `.vinxi` build artifacts were already dirty before this task, same as prior batches).

**What's in the baseline:**

1. **vxe semantics** — header filter icon → floating panel with checkbox options + confirm/clear, `filter-multiple` OR-match, remote serialization; noted that `/tmp/vxe-grid` was cleaned up, so filter-panel semantics are reconstructed from documented vxe behavior (flagged for re-verification in adapt). Also captured vxe's `formatter` concept and the deliberate narrowing to display-only.

2. **Proposed iris design (additive, react only), grounded in code evidence:**
   - **a) `formatter?: (value, row) => ReactNode`** — slots into the cell fallback chain at `Table.tsx` L1785–1798 (`render` → `html` → **formatter** → raw); tooltip default content (`cellTooltip`, L1359) uses the formatter output when it's a string, else falls back to raw; verified sort/filter/summary/edit all read raw via `getCellValue`, so they're untouched by construction.
   - **b) `'textarea'` editor** — new editor branch with `data-iris-table-editor-textarea`, Enter/blur commit + Escape cancel + `aria-invalid`/`aria-describedby` identical to the text editor, Shift+Enter as the newline escape hatch; the `editorRef` union at L595 must widen to include `HTMLTextAreaElement`; `coerceValue` needs no change.
   - **c) Filter panel** — `filterable` + `filterOptions` (column), controlled `filterValues`/`onFilterValuesChange` (props); header trigger `data-iris-filter-trigger` in both flat and grouped header paths; new `FilterPanel.tsx` reusing the batch-H ContextMenu pattern (`useFloating` + `useDismiss` + portal + capture-phase scroll-close) but anchored to the **real trigger button** (no virtual anchor needed); draft/confirm/clear semantics (confirm writes, clear applies immediately, dismissal discards); OR-match in the `filteredData` memo (string comparison, empty key → no filter, AND with the text channel); remote mode merges comma-joined values into `initialParams.filters` + the remoteFilter effect; new i18n keys `table.filterConfirm`/`table.filterClear` (+ proposed `table.filter` for the trigger's accessible name).

3. **File map** — 2 new test files, `FilterPanel.tsx` (~110 lines), ~160 additive lines across types/props/Table/i18n; ContextMenu/useFloating/useDismiss/Checkbox untouched.

4. **28-case test plan** + 10 open questions (textarea Enter vs newline, formatter precedence, filterMethod interplay, comma-join ambiguity, page reset on remote confirm, etc.).
