Batch BT complete. Committed as **`12addddc`** — `feat(table): vxe-grid 批 BT——行选择拖拽 selectionDrag（iris 独有）`.

## Report

### What was implemented

Table-level `selectionDrag?: boolean` (iris-only, mouse-drag checkbox range — vxe has no parity) per `batch-bt-baseline.md`:

| File                                            | Change                                                                                                                                                                                                                                                                                                    |
| ----------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/react/src/primitives/table/props.ts`  | +1: single-line `selectionDrag?: boolean` (after `checkboxRange`)                                                                                                                                                                                                                                         |
| `packages/react/src/primitives/table/Table.tsx` | 5 touchpoints (+~150): destructure; 4 refs + 3 handlers + `hitTestSelectionRowKey` helper (after row-drag handlers); `__selection` cell `onPointerDown` + onClick suppression gate (`checkboxRange \|\| selectionDrag`); root pointer gates 3→4 drag dispatch (onPointerMove/onPointerUp/onPointerCancel) |
| `test/selection-drag.test.tsx` (new)            | **13 tests, 269 lines** (≤500)                                                                                                                                                                                                                                                                            |
| `manifest.json`/`llms.txt`                      | regenerated via `pnpm gen:manifest` (propCount **159→160**, eventCount **30 unchanged**)                                                                                                                                                                                                                  |
| `docs/vxe-grid-comparison.md`                   | 3 places: 独有表行 / 构建状态 / 测试计数                                                                                                                                                                                                                                                                  |

### Semantics (baseline zero-drift)

- Press on the `__selection` cell (multi mode) selects **nothing**; pointermove past the **4px threshold** (row-drag aligned) starts the drag
- `document.elementFromPoint` → `closest('[data-iris-table-row]')` (range-fill precedent): group-header/detail slots carry no such attr, summaries/footers resolve to no body index → naturally ignored; non-row areas keep the last applied range
- String key domain `findIndex` (rowDrag/scrollToRow same style — number/string keys never mix); **closed interval [anchor, hover]**, checkMethod-eligible rows only, committed as a **monotonic union** (`seen` set → `rebaseToProp()` + `selModel.set([...display, ...add])`, selectAll additive precedent) — reverse drags shrink the interval but never uncheck
- Click suppression reuses the shift-click mechanism (cell onClick `preventDefault` cancels label→input forwarding AND the change): the trailing click after a drag cannot double-toggle the anchor row; a plain click (<4px) still toggles a single row; the flag is re-armed on every press so an abandoned drag (no trailing click) never swallows the next plain click
- Pointer capture on the press cell keeps pointermove/up on the table even when released outside the root; pointercancel clears pending/anchor/seen (nothing committed)
- fiats: no-prop laziness (no handlers attached), single-mode no-op, controlled no optimistic flip (parent rejection keeps the UI unchanged), tree mode drags across flattened visible rows, disabled anchor can still start the drag, pre-existing selections retained

### Verification — all ✅

- core test: **1517/1517**
- react typecheck: clean
- react test: **2294/2294** (+13)
- react lint: **0 errors** (1 pre-existing complexity warning)
- spec `--mode all --json`: **0 violations**
- `pnpm gen:manifest` regenerated + `check:manifest` up-to-date (155 components)

### Files changed (8 committed)

props.ts · Table.tsx · test/selection-drag.test.tsx (new) · manifest.json + llms.txt (regenerated) · vxe-grid-comparison.md · batch-bt-adapt.md (new) · batch-bt-baseline.md (new, runner pre-written)

### Left

- vue/solid/svelte alignment deferred (react-only batch scope); runner's pending review/gate stage; pre-existing `DECISIONS.md` / `batch-bs-gate.md` modifications left untouched (not this batch's content).
