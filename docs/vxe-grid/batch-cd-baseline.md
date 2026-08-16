Baseline written and verified. Summary of the deliverable:

**`/home/u1/iris-ui/docs/vxe-grid/batch-cd-baseline.md`** (new file; zero source files touched — the 2 `M` entries are prior-stage docs, untouched)

## Baseline essence (batch CD：行拖拽插入指示线, iris 独有)

**Design** — no new prop (additive fail-closed: `rowDrag` is already opt-in at props.ts:358). During an active drag, a 1px primary line (`data-iris-row-drag-indicator`, `var(--iris-primary)`, pointer-events none, zIndex 2, full-width absolute in the root) renders **between rows** — at the over row's top edge (above) or bottom edge (below).

Key mechanics, all anchored to HEAD `a39fe1b9`:

- **One pure source of truth** `resolveRowDragDrop(pointerY, activeId, overId, overRect, rows)` shared by the move handler (draws the line) and the up handler (commits the drop) → the row always lands where the line was drawn.
- **Direction semantics**: side = pointer vs. the over row's midpoint (dnd-kit style); dragging across a row's center flips above→below — "由移动方向决定".
- **Root anchor**: `position: relative` forced after `...style` when `rowDrag` is on (BU watermark precedent).
- **Cleanup (spec-required)**: pointerup (both branches) / pointerleave / pointercancel all clear the indicator + refs; commit skips `onReorder` on net-zero moves.
- **Existing-test compatibility proven**: the vxe-parity geometry (header row occupies rect[0]) makes the old assertion `[2,1,3]` identical to the new side-aware result — regression guard stays green.

**File map**: `Table.tsx` only (helper + state + root style + 4 handler wirings + indicator JSX) + NEW `row-drag-indicator.test.tsx` (10 tests). Zero changes to props/types/core/styles/i18n; manifest propCount stays 168.

**Test plan**: 10 cases — render 6 (below/above/方向翻转/active-self 无线/header 无线/阈值前无) + cleanup 4 (up 后消失+落点一致 / no-op 不通知 / leave / cancel), jsdom rect stubbing per the vxe-parity mold.

**8 fiats + 3 open questions**, with O1 (mid-drag scroll not tracked) documented as pre-existing F1 semantics, not a defect.
