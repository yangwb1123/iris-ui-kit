Baseline complete. `/home/u1/iris-ui/docs/vxe-grid/batch-aq-baseline.md` (38 lines, 11KB) — `git status` confirms only the new doc; zero source files touched.

**What the baseline covers** (every claim verified against current code):

**a) `rangeFill?: boolean` — handle rendering** (additive, default `false`):

- Gate: `cellRange && rangeFill && cellRangeCtrl.getRange() !== null` (Table.tsx:900 destructure; core `cell-range.ts:52-96` normalized `start`/`end`).
- Placement (spec's prescribed option): render inside the last selected cell (`range.end`, bottom-right) — `<span data-iris-range-fill>` absolute `right:0/bottom:0`, 6px square `var(--iris-primary)`. The cell is a grid item (`display:grid`, TableRow.tsx:107), so no rect math; the end cell gains `position:relative` (BASE_CELL_STYLE has none, styles.ts:14-23) + `zIndex:2` (above pinned sticky `zIndex:1`). Handle stops propagation so the cell's `onClick` (startRange/extendRange, TableRow.tsx:205-214) never fires; `aria-label` via new `table.rangeFill` i18n key. Re-renders for free from the subscribed `cellRangeState` (Table.tsx:3262-3266).

**b) Drag behavior** — rowDrag raw pointer pattern chosen over `useDrag` (the hook binds move/up to the handle element; the fill must hit-test cells beyond the handle): handle pointerdown → extend the existing root `onPointerMove/Up` condition `rowDrag || columnDrag` (Table.tsx:5796-5812) to `|| rangeFill`. Hit-test per move via `elementFromPoint` → `closest('[data-iris-cell-row][data-iris-cell-col]')`. Target = rectangle from `range.start` to drag end, down/right-only clamp (`max(pointer, range.end)`, table bounds); no extension → no-op. Extension cells get `data-iris-range-fill-target` + surface-selected background (source keeps `data-iris-cell-selected`). On pointerup: cyclic fill `(r,c) ← ((r-start.row)%rangeRows+start.row, (c-start.col)%rangeCols+start.col)`, values via the `getCellValue` choke point, byKey patch → **ONE `commitRowList`** (Table.tsx:2611 — undo-covered via batch AL funnel); formula columns skipped; then `extendRange(endRow, endCol)` + `updateRangeToolbarAnchor()` so the range grows to the drag end (Excel parity).

**c) Keyboard**: no new keys — existing Escape clears the range (hence the handle), Shift+Arrow/Shift+Click/F2/Delete untouched; root `onKeyDown` condition unchanged (Table.tsx:5787).

**File map**: props.ts, Table.tsx, TableBody.tsx (prop threading), TableRow.tsx (handle + target highlight), core i18n.ts + zh locale, new `range-fill.test.tsx` (~17 cases: pointerdown-not-a-click, L-shape highlight, single-commit cyclic values, bounds clamp, range-extension, formula skip, no-rowKey no-op, undo). No new core API. 12 numbered fiats for gate arbitration (inside-cell placement, identity-within-source skip, down/right-only semantics, elementFromPoint vs rect stubs, container-pattern choice, virtual-scroll limitation documented).

All cited line numbers were re-verified against the current tree (pasteIntoRange:3401, isEditableColumn:592, handleCellRangeKey Escape:3319, handleTableShortcutKey:3351, root onKeyDown:5787).
