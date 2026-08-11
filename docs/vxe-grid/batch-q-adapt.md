All done. Final report:

## Implemented — vxe-grid batch Q (all 3 features)

**Files changed (5 source + 1 test):**

1. `packages/react/src/primitives/table/props.ts` — 3 new single-line props: `scrollbarConfig?: { theme?: 'default' | 'thin' }`, `editDirtyConfig?: { indicator?: boolean; className?: boolean }`, `autoResize?: boolean` (with JSDoc)
2. `packages/react/src/primitives/table/types.ts` — new exported `IrisTableScrollbarConfig`, `IrisTableEditDirtyConfig`
3. `packages/react/src/primitives/table/Table.tsx` — live `TABLE_ROW_CSS` gains thin-scrollbar + dirty-dot rules; `dirtyCellsRef` (keyed `` `${rowKeyVal}:${colKey}` ``) + `trackDirty` hooked into the single `commitValue` funnel (cell + row modes); module-level `dirtyCellState` helper feeds `data-iris-cell-dirty` attr / `iris-cell-dirty` class / `position: relative` per cell (kept cyclomatic complexity flat); `autoSize` state + RO effect (jsdom guard, cleanup disconnect); `fixedHeight` extended so auto-filled roots engage sticky-header/overflow after a positive measure; root gets `data-iris-scrollbar-thin` / `data-iris-auto-resize` + inline measured height when no explicit `height`
4. `packages/react/src/primitives/table/styles.ts` — dormant mirror gets the same CSS rules
5. `packages/react/src/primitives/table/index.ts` — exports the 2 new types
6. **NEW** `packages/react/src/primitives/table/autoresize-scrollbar-dirty.test.tsx` — 175 lines

**Tests added: 12**

- scrollbarConfig (2): thin attr renders; absent by default / `'default'` theme
- editDirty (6): commit marks dirty → attr present; committing the original removes it; another changed value keeps it; no config → absent; `indicator: false` suppresses attr; `className: true` adds class while keeping attr
- autoResize (4): mocked RO (captured callback) applies `height: 400px`→`512px` inline + `data-iris-auto-resize`; observer disconnected on unmount; no RO (jsdom) → renders without crash; explicit `height` wins (no visible change)

**Verification (all green):**

- `typecheck` ✅ clean
- `test` ✅ 1721 passed (155 files, +12)
- `lint` ✅ 0 errors, 1 warning (pre-existing `IrisTable` complexity warn-only rule, already exceeded at baseline 142→151; my refactor kept the cell-render arrow at ≤70 — no new warning)
- `iris-ui-spec.py --mode all` ✅ 0 violations
- Prettier ✅ clean

**Unfinished:** none — all 3 items done (1+2+3). `docs/vxe-grid/DECISIONS.md` modification and `batch-q-baseline.md` pre-date my session. One design note: the dirty dot uses `right: 4px` per spec exactly (could be `inset-inline-end` for strict RTL logical-property compliance if reviewers prefer).
