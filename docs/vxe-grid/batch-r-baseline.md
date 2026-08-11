Baseline written to `/home/u1/iris-ui/docs/vxe-grid/batch-r-baseline.md` (105 lines). No source files modified — `git status` shows only the new doc.

**Verified against current sources:**

- **Root** (`Table.tsx:3749`, style merge `:3791-3817`, `...style` last): no zIndex today; internal stacking = header `z-index: 2` (CSS `:66-72`), pinned cells `zIndex: 1` (`:2102`).
- **rowKeyOf** (`:1704-1706`): field-only; the idx fallback lives at call sites (`k ?? idx` `:2617`); ~24 call sites flow through it (selection/dirty/expansion/drag/lazy-tree/edit).
- **Footer stack** (`renderFooterStack` `:3236`): footerMethod → summary (`renderSummaryRow` `:3123`) → footerData (`:3321`); `footerOccupyRef` (`:1461`) cleared per render only under `footerSpanMethod` (`:3239`); occupy-skip + `gridColumnEnd: span N`; rowspan inert (batch-P review fix).
- **autoResize** (batch Q, `:2452-2475`): RO → `autoSize`; single consumer = `fixedHeight` gate `:3221-3224`; `height: 100%` when no explicit height.
- **liveData seed** (`:838`) is the only reference-copy point; external sync effect `:846-866` adopts new data refs as-is.
- **vxe reference** (real path `/tmp/vxe-ref/es/table/src/props.js`): all five names exist — `zIndex` `:182`, `keepSource` `:187`, `syncResize` `:197`, deprecated string `rowId` `:175-181`, `mergeFooterItems` `:143` (with `mergeFooterCells || mergeFooterItems` alias, `table.js:3229-3231`).

**Key design decisions (as specified, additive):**

- **a)** `zIndex` → root style ahead of `...style`; note that CSS z-index is inert on static elements → propose `position: 'relative'` alongside (Q1); vxe's global stacking registry deliberately not replicated.
- **b)** `syncResize` — ignored when autoResize on; shared `measureRoot` extracted (RO callback reuses it, so it literally re-runs autoResize's measure), compact effect keyed `[liveData.length, tableLoading, tableError]` + visibilitychange; `fixedHeight` gate parity proposed (Q2).
- **c)** `keepSource` — doc-only flag; mount-time `[...data]` copy at the seed; shallow copy; sync-effect re-feeds stay controlled hand-offs (Q3).
- **d)** `rowId` — `rowKeyOf(row, rowIndex?)` gains the slot: `row[rowKey] ?? rowId(row, idx) ?? idx`; index passed at index-bearing call sites; without rowId byte-identical (additive guard); documented divergence vs vxe's deprecated string.
- **e)** `mergeFooterItems` — same occupy-skip via `footerOccupyRef` in all three footer paths; occupy-clear condition extended; function wins when both exist; rowspan inert; out-of-stack entries no-op.

File map: `types.ts` +1 alias, `props.ts` +5 props, `Table.tsx` ~+80-100 lines, new `batch-r.test.tsx`; core/i18n/styles.ts untouched. Test plan Z1-Z3/S1-S4/K1-K3/R1-R6/M1-M7 + 6 open questions.
