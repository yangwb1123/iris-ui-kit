Batch T complete — all items implemented and verified.

## Summary

**Implemented (all four work items, react-only, additive):**

1. **Handle methods** (`props.ts` + `Table.tsx`): `scrollToRow` (attribute-located row node, `scrollIntoView({ block: 'nearest' })`, jsdom-guarded), `toggleRowExpand` (tree + detail share the single expansion model, no-op for plain tables), `clearSort` (single `setSort(null)` / multi `setMultiSort([])`), `clearFilter` (`onFiltersChange?.({})` + `onFilterValuesChange?.({})` — both channels are controlled-only, no internal mode), `setCurrentRow`/`setCurrentColumn` (find row/column, fire existing handlers with the same veto guards as the click paths, no-op without handlers — documented).
2. **Events**: `onCellDblClick` fires after the edit begins (non-editable columns now fire too); `onRowDblClick`; `onHeaderClick` after the sort toggle in both flat + grouped branches; `onExpandChange`/`onTreeExpandChange` with the new state (incl. lazy-load branch); `onFilterChange`/`onFilterValuesChange` **not added** — both channels already exist from batch I, documented on `onFiltersChange`.
3. **Radio UI**: `selectable='single'` renders native `input[type=radio]` (`data-iris-table-radio`, `accent-color: var(--iris-primary)`, same aria/disabled/onChange); header stays empty; multi unchanged.
4. **Pager total**: `pagerConfig.showTotal` renders `<span data-iris-table-total>` via i18n `table.total` (en `Total {total}`, zh `共 {total} 条`) before the size selector.

**Files changed:** `props.ts` (+12 declarations), `Table.tsx` (~+130), `useTableSort.ts` (+2 — exposed the already-implemented `setMultiSort`), `packages/core/src/i18n.ts` (+1 key), `packages/plugin-locale-zh/src/core/index.ts` (+1 key), regenerated `manifest.json`/`llms.txt`; tests: new `handle-events-radio-total.test.tsx` (**24 tests, ~470 lines ≤500**) + 2 single-mode radio selector updates in pre-existing tests.

**Counts:** react 1774/1774 tests · 158 files · typecheck ✓ · lint 0 errors (1 pre-existing complexity warning) · spec scanner 0 violations · core 1249/1249 · `check:manifest` up to date.

**Unfinished:** none. One noted deviation: 5 source files (vs 4) — `useTableSort.ts`'s `setMultiSort` exposure was required by the baseline's own assumption.
