Complete. All verification gates green on the committed state.

## Report

**Commits** (2, per CB/CA convention):

- `9c1a1ed1` — `feat(table): grid 批 CD——行拖拽插入指示线（iris 独有）`
- `9f14eb13` — `docs(table): batch CD adapt report`

**Files changed** (2 source/test + 1 report; ≤4 + tests):

| File                                                                   | Change                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| ---------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/react/src/primitives/table/Table.tsx`                        | Module-scope pure `resolveRowDragDrop<Row>` + `RowDragDropResolve` interface (side = pointer vs over-row midpoint, dnd-kit style; insertIndex in original-array space) · `rowDropTarget` state + `rowDropRef` (exact line-drawing inputs) · `updateRowDropIndicator` in the move handler · up handler commits through the **same resolve** (net-zero skips `onReorder`) · leave + new pointercancel branch clear line+refs · root forced `position: relative` after `...style` when `rowDrag` on (BU-watermark precedent) · indicator JSX (`data-iris-row-drag-indicator` + `data-iris-row-drag-side`, 1px `var(--iris-primary)`, logical full-width inset, pointerEvents none, zIndex 2) |
| `packages/react/src/primitives/table/test/row-drag-indicator.test.tsx` | **NEW** — 10 tests, 212 lines (≤500)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `packages/manifest/{manifest.json,llms.txt}`                           | regenerated via `gen:manifest` — **zero diff** (no new props/components; propCount 168, components 155 already current)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `docs/vxe-grid/batch-cd-adapt.md`                                      | report                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |

**Tests added**: 10 — render 6 (① below ② above ③ 方向翻转 + single-node invariant ④ active-self 无线 ⑤ header 无线 ⑥ 阈值前无) + cleanup 4 (⑦ up 消失 + 落点一致 `[2,1,3]`/`[2,3,1]` both sides ⑧ net-zero 画线不通知 ⑨ leave 清除+中止 ⑩ cancel 清除+中止). jsdom rect stubs per vxe-parity geometry (header = rect[0]); act-wrapped plain Events. **Finding**: React implements `onPointerLeave` over native `pointerout` — test ⑨ dispatches `pointerout`.

**Counts**: react 2409→**2419** · core 1533 unchanged · manifest propCount 168 · spec 0 violations.

**Verification (all ✅)**:

- core test: 1533/1533
- react typecheck: clean · react test: 2419/2419 (table 1091/1091 incl. vxe-parity rowDrag regression)
- react lint: 0 errors (1 pre-existing IrisTable complexity warning)
- `iris-ui-spec.py --mode all --json`: 0 violations
- `gen:manifest`: regenerated (no diff), prettier clean, react build success

**What is left**: runner's review/gate stage. Working-tree `DECISIONS.md`/`batch-cc-gate.md` mods + untracked `batch-cd-baseline.md` are prior-stage leftovers (untouched, per CB precedent). Baseline open questions deferred per fiat: O1 (mid-drag scroll not tracked) = pre-existing F1 semantics, not a defect; O2/O3 (per-prop opt-in, line styling knobs) deferred.
