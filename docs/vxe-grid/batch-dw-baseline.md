Baseline written to `/home/u1/iris-ui/docs/vxe-grid/batch-dw-baseline.md` (38 lines). No source files modified.

**Verified (HEAD `e671b85c`)** — `onTableEvent` → zero hits; forward design. Read all 6 event families in Table.tsx + props + manifest:

- **Manifest gate**: propCount **201→202**, eventCount **32→33** (`on[A-Z]` props count as events — verified `packages/manifest/src/contracts.ts` and current manifest.json).
- **Design**: `onTableEvent?: (event: { type: string; detail: unknown }) => void` in props/layout.ts (spec-literal, above `onCellClick`); public `IrisTableEvent` type + closed 14-type palette (`cell-click`/`cell-dblclick`/`row-click`/`row-dblclick`/`sort-change`/`multi-sort-change`/`filter-change`/`filter-value-change`/`edit-start`/`edit-commit`/`edit-cancel`/`expand-change`/`tree-expand-change`/`expanded-rows-change`).
- **Bridge, not behavior**: one `emitTableEvent(type, detail)` funnel over an `onTableEventRef` mirror (established :1866 pattern), emitted **after** each existing dedicated callback at 14 paired sites (precise line map in the doc). Gates shared verbatim → parity by construction: no `onCellClick`/`rowMode` → no cell-click bus event; controllable proxy `sort` updates fire no bus event; the expansion family mirrors the shared `onExpandedRowsChange` channel (`expandAll` seed + restores DO fire `expanded-rows-change` — pinning tests in the batch).
- **React-only**: zero core/other-framework/style/i18n changes.
- **File map**: props/layout.ts +1 prop · types +1 type · Table.tsx ~35 lines / 4 touch points · manifest regenerated · NEW `test/batch-dw.test.tsx`.
- **Test plan**: 16 cases — one trigger per event type (cell/row click+dblclick, header sort cycles incl. multiSort, filter panel apply + `tableRef.clearFilter()`, dblclick-edit start/commit/Escape-cancel, detail/tree/rowExpandable toggles), plus detail-fidelity (reference-identical `detail.row`/`column`), gate-parity, and regression (prop omitted = zero cost; dedicated callbacks fire exactly once; zero-noise assertion).

Known test-trigger caveat captured as a non-blocking note: cell click/dblclick handler attach is gated on the dedicated callbacks (or `rowMode`/`editableLive`), so those tests wire no-op `onCellClick`/`onCellDblClick` and click `[data-grid-row][data-grid-col]` (base attr) rather than the `cellRange`-only `data-iris-cell-*` attrs.
