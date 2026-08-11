All committed, working tree clean. Batch R complete.

## Report

**Files changed (5, all additive, React-only, core untouched):**

| File                                                      | Change                                                                                                                                                                                   |
| --------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/react/src/primitives/table/types.ts`            | +`IrisTableMergeFooterItem` interface (row/col/rowspan/colspan, footer-stack coordinate space documented)                                                                                |
| `packages/react/src/primitives/table/props.ts`            | +5 props: `zIndex`, `syncResize`, `keepSource`, `rowId` (single-line fn type), `mergeFooterItems` (named interface)                                                                      |
| `packages/react/src/primitives/table/Table.tsx`           | +131 net lines: destructure, liveData seed, `rowKeyOf(row, idx)`, tree key map, shared `measureRoot` + syncResize effect, `footerMergePlan` + shared `footerCellSpan` helper, root style |
| `packages/react/src/primitives/table/index.ts`            | export `IrisTableMergeFooterItem`                                                                                                                                                        |
| `packages/react/src/primitives/table/final-gaps.test.tsx` | new, 329 lines, 19 tests                                                                                                                                                                 |

**Implementation notes:**

1. **zIndex** — root gets `position: relative` + `zIndex` before `...style` (caller override wins; documented CSS inertness).
2. **syncResize** — extracted shared `measureRoot` (RO callback now calls it); effect keyed on `[data, loading, error, footerData, size, bordered]` + `visibilitychange`; skipped when `autoResize` on or `height` set; same `height: 100%` + fixedHeight application as autoResize.
3. **keepSource** — `useState` seeds with `[...data]`; re-feeds keep hand-off; table documented immutable either way.
4. **rowId** — `rowKeyOf(row, idx)` = `row[rowKey] ?? rowId(row, idx) ?? idx`; index threaded at all index-bearing sites (renderRow, selection maps, toggle/range, row drag, detail expansion, virtual keyOf, expandAll seed, edit commit). Tree flatten gets a `treeKeyMap` (sibling-index precompute, null without rowId → byte-identical). Edit write-back falls back to computed-key lookup only when `rowId` is set. fnr sites intentionally left (field-based write-back).
5. **mergeFooterItems** — precomputed occupy plan (rowspan covers later rows' cells via the occupied set); `gridColumnEnd`/`gridRowEnd` spans on origin cells; shared `footerCellSpan` helper drives all three footer paths (summary/footerMethod/footerData); `footerSpanMethod` wins when both provided; out-of-stack entries no-op; same 0-based footer-stack coordinate space documented.

**Verification (all green):**

- typecheck ✓ · test **1738/1738** (155 files; 19 new tests) ✓ · lint **0 errors** (1 pre-existing complexity warning, 150→157) ✓
- spec checker **0 violations** ✓ · prettier ✓
- `pnpm gen:manifest` **run and committed** (manifest 155 components; all 5 props extracted; fixed scanner issue — `/** text` JSDoc first line was dropped, rewrote to multi-line format so descriptions are complete)

**Unfinished:** none — all five items implemented with full test coverage. Minor documented limitations: imperative handle row ops address rows by `rowKey` field only; lazy-tree + keyless-rowId rows stay degenerate (pre-existing).
