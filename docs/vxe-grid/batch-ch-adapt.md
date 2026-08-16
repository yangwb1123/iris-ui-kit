All done. Final report:

## Report

**Commits**:

- `4f07fd8a` `feat(table): grid 批 CH——列宽拖出固定（iris 独有）`
- `8f28ac46` `docs(table): batch CH adapt report + baseline`

**Files changed** (2 source + 1 test + manifest; ≤4 + tests met):

- `packages/react/src/primitives/table/props.ts` — `columnDrag` JSDoc extended for the drag-out pin; **doc comment only, no type change** (manifest propCount stays **169** / eventCount **31**; manifest diff = description text only).
- `packages/react/src/primitives/table/Table.tsx` (+78): module-level pure helper `isColDragOutLeft(x, rootLeft)`; `handleColDragPointerUp` → `resolveColDrag(x, _y)` — edge check **first** (`x < rootRect.left`, gated `columnDrag && columnPinMenu` → `setColumnPinned(key,'left')`: already-left no-op, right→left flip, **never reorders**, controlled never flips optimistically), else the existing closestCenter reorder path byte-for-byte; root `onPointerUp` passes release coords; window `pointerup`/`pointermove`/`pointercancel` effect **gated on `colDragActive` in the gated config** (fresh closure via render-assigned ref) — covers the drag-out release that previously left the controller stuck in `activeId`. Plain `columnDrag` keeps vxe parity with zero global hooks.
- NEW `packages/react/src/primitives/table/test/column-pin-drag.test.tsx` — **13 tests / 357 lines** (≤500): spec's ①拖出固定 → T1 (controlled pin + callback, no reorder) / T2 (uncontrolled internal state); T3/T4 fail-closed (columnDrag-only, columnPinMenu-only); T5 already-left no-op; T6 right→left flip; T7 in-band reorder regression; T8 same-column no-op; T9 window pointerup + stuck-state fix; T10 tap cancel; T11 pointercancel abort; T12 controlled no-optimistic-flip; T13 grouped-header leaf only.
- `packages/manifest/{manifest.json,llms.txt}` — regenerated & committed (columnDrag description in both entries; counts unchanged).

**Counts**: react 2454→**2467** · core 1533 unchanged · manifest propCount **169** unchanged · spec **0 violations**.

**Verification** (all ✅ on committed state): core test 1533/1533 · react typecheck · react test 2467/2467 (drag-out + vxe-parity + pin-menu suites green) · react lint **0 errors** (1 pre-existing IrisTable complexity warning, unchanged at 284) · `iris-ui-spec.py --mode all --json` **0 violations** · `gen:manifest` regenerated + `check:manifest` up-to-date · prettier clean · manifest package tests 69/69 · framework-free invariant holds (0 framework imports in core).

**What is left**: runner's review/gate stage. Pre-existing, untouched: `arch-check:ratchet` is red on the committed baseline too (stale baseline — Table.tsx 1255 vs 10074; 17 violations before AND after, no new files added to the violation set), plus prior-stage doc dirt (`DECISIONS.md`, `batch-cg-gate.md`). No baseline open questions.
