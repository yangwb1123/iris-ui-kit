Baseline written to `/home/u1/iris-ui/docs/vxe-grid/batch-e-baseline.md` (335 lines; the only change — no source files touched; the `apps/ssr-solidstart/.vinxi` modifications are pre-existing build artifacts).

## Key findings baked in

**vxe semantics** (grounded in `/tmp/vxe-grid/package/types/components/table.d.ts`):

- Three `checkMethod` sites: L1065 is the **CustomConfig column-level** veto (personalization dialog — out of scope); L1435 `RadioConfig` and L1507 `CheckboxConfig` are the **row-level vetoes** (`{ $table, row }` → `false` = row uncheckable; select-all skips vetoed rows; existing selection is not retroactively purged).
- Row ops live in `table-module/edit.d.ts` (`insert`/`insertAt`/`remove` + `getRecordset` diff tracking) with grid-side `setRow`/`reloadRow` in `TableMethods`; vxe is row-object/rowid addressed, iris simplifies to key-addressed (`rowKey`).
- `pagerConfig.pageSizes` (grid.d.ts L46-66 + pager.d.ts L88): number[] or `{label,value}`[]; size change **resets page to 1**.

**iris evidence + a critical finding**:

- The liveData write-back pattern is `setLiveData(prev => { const next = setCellValue(...); externalDataRef.current = next; return next })` (Table.tsx L578-581) — the handle ops should reuse this exact shape with core pure functions.
- **Core `applyParams` (remote-table.ts) only resets page on sort/filter value changes — NOT on pageSize change.** The size-switcher bridge must pass `{ pageSize, page: 1 }` explicitly (flagged as open question 5: bridge-level vs core-level reset).
- Selection model has `deselect(key)` for pruning removed rows; `toggleAll` currently toggles all keys unconditionally (needs veto filtering); `IrisCheckbox` supports native `disabled`; `IrisSelect` is ready for a `sm` size selector.

**Design**: (a) `IrisTableHandle<Row>` `{insertRow/removeRow/updateRow/refetch}` via additive `tableRef` prop, assigned on mount; (b) `checkMethod(row, rowIndex)` — disabled render + `toggleRow` guard + filtered `toggleAll`/`allKeys` (rowIndex is a flagged deviation, vxe passes `{row}` only); (c) `pagerConfig.pageSizes` — `IrisSelect` next to `IrisPagination` in the existing proxy pager block (L2128), `setParams({pageSize, page:1})` + `onPageChange`.

**Split**: core gets `table-rows.ts` (pure `insertRowInList`/`removeRowFromList`/`updateRowInList` + tests); react bridge keeps handle assembly, liveData wrapper, selection pruning, veto wiring, and the pager selector. 10-file map + 6 open questions included.
