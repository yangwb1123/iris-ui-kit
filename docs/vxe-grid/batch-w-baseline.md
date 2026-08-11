Baseline written to `/home/u1/iris-ui/docs/vxe-grid/batch-w-baseline.md`. No source files modified (`git status` shows only the new doc).

**Key findings:**

1. **filteredData memo** (`Table.tsx:2334-2362`) is the filtered+sorted list. Proxy mode merges only the prop `filters` (`proxy ? (filters ?? {}) : mergeFormFilters(...)` at 2340) — the loaded page after local filtering, exactly the documented batch-C behavior; `remoteFilter` passes `sortedData` through unchanged. Tree mode builds `bodyData` from `sortedData` (not filteredData), so filters never hide tree rows — documented divergence for the new accessor.
2. **Handle** (`types.ts:405-447`, assigned `Table.tsx:2043-2109`): 20 methods; `getData` (2109) returns the raw live list. `plugin-pro-table` already exposes `exportCsv()` using `visibleColumns()` — the display-columns precedent.
3. **exportCsv** (`exportCsv.ts:12-24`): pure `(rows, columns) → string` (`toCsv`, values via `dataIndex ?? key`, formula-injection neutralized); `downloadCsv` (BOM + save) is deliberately separate. **Table.tsx never calls it** — `toolbar.onExport` (`Table.tsx:4024-4028`) only fires the callback, caller wires the helper (batch L design; no toolbar import/export demo in this repo).
4. **baseCellStyle** (`Table.tsx:2972-2979`, `overflow: hidden; ellipsis; nowrap`) is **already applied** to header cells (4564/4718), summary (3723), footerMethod (3812), footerData (3871) — so the new props' default `true` is byte-identical to today. vxe parity: `showHeaderOverflow`/`showFooterOverflow` exist verbatim at `/tmp/vxe-ref/packages/table/src/props.ts:159-167`.

**Design (additive, react only):** a) `getFilteredData()` → `[...filteredData]` copy; b) `exportCurrentViewCsv()` → `exportCsv(getFilteredData(), leafColumns)` — `leafColumns === displayColumns` in flat mode, true value columns when grouped, hidden columns already excluded; pure string, parent downloads; c) `showHeaderOverflow`/`showFooterOverflow` (default true) → spread `{ whiteSpace: 'normal', overflow: 'visible' }` after `baseCellStyle` at the 2 data-header + 3 footer sites when false.

**File map:** `types.ts` +2, `props.ts` +2, `Table.tsx` ~+12, new `test/export-view.test.tsx` (~10 tests). 4 open questions (tree-mode semantics, Excel twin, per-cell style interaction, body-level `showOverflow` parity).
