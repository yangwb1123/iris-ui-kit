Batch CH complete and committed.

## Report

**Commits**: `feat(table): grid 批 CH——列宽拖出固定（iris 独有）` + docs adapt report commit.

**Files changed** (2 source + 1 test + manifest + docs; ≤4 + tests met):

- `packages/react/src/primitives/table/props.ts` — `columnDrag` JSDoc extended to document the drag-out pin (Batch CH) — **doc comment only, no type change** (manifest propCount stays **169**, eventCount **31**; manifest diff = description text only).
- `packages/react/src/primitives/table/Table.tsx` — module-level pure edge helper `isColDragOutLeft(x, rootLeft)`; `handleColDragPointerUp` → `resolveColDrag(x, _y)` with the edge-pin branch **first** (gated `columnDrag && columnPinMenu`: release `x < rootRect.left` → `setColumnPinned(key, 'left')` — already-left no-op, right→left flip, never reorders, controlled mode never flips optimistically — else the existing closestCenter reorder path byte-for-byte); root `onPointerUp` passes release coords; new window `pointerup`/`pointermove`/`pointercancel` effect **gated on `colDragActive` in the gated config** (fresh closure via render-assigned ref) — covers the actual drag-out gesture that previously left the controller stuck in `activeId`. Plain `columnDrag` (vxe parity) keeps zero global hooks.
- NEW `packages/react/src/primitives/table/test/column-pin-drag.test.tsx` — **13 tests / 357 lines** (≤500): spec's ①拖出固定 → T1 (controlled pin + callback, no reorder) / T2 (uncontrolled internal state) + T3/T4 fail-closed (columnDrag-only / columnPinMenu-only), T5 already-left no-op, T6 right→left flip, T7 in-band reorder regression, T8 same-column no-op, T9 window pointerup incl. stuck-state fix, T10 tap cancel, T11 pointercancel abort, T12 controlled no-optimistic-flip, T13 grouped-header leaf pins only.
- `packages/manifest/{manifest.json,llms.txt}` — regenerated & committed (columnDrag description updated in both framework entries; counts unchanged).

**Counts**: react 2454→**2467** · core 1533 unchanged · manifest propCount **169** unchanged · spec **0 violations**.

**Verification** (all ✅ on committed state): core test 1533/1533 · react typecheck · react test 2467/2467 · react lint **0 errors** (1 pre-existing IrisTable complexity warning, unchanged at 284) · `iris-ui-spec.py --mode all --json` 0 violations · `gen:manifest` regenerated + committed + `check:manifest` up-to-date · prettier clean · manifest package tests 69/69.

**What is left**: runner's review/gate stage. Working-tree dirt (`DECISIONS.md`, `batch-cg-gate.md`) is prior-stage leftovers, untouched. `arch-check:ratchet` is pre-existing red (stale baseline — Table.tsx at 1255 vs 10074 committed, 17 violations before AND after this change; no new files added to the violation set) — outside this batch's scope. No baseline open questions.
