Baseline written to `/home/u1/iris-ui/docs/vxe-grid/batch-j-baseline.md` (360 lines). No source files modified — the only change is the new doc.

## Key findings baked in

**Code evidence** (all read-only):

- **Tree mode**: `flattenTree` memo at Table.tsx L1112 (`getChildren: withSortedChildren(getSubRows, treeComparator)`), caret render L1729 (parent → toggle button / leaf → 16px spacer), `expandAll` seeding L1169 walks `getSubRows` only. Core `flattenTree` derives `hasChildren` from `getChildren` — so a lazy map consulted _first_ flips a loaded node to the normal parent branch with zero extra flags.
- **Editing**: `createCellEdit` core controller; `commitEdit(): boolean` returns false on validation failure (session stays) and returns false immediately for async validation (commits later, no completion promise — flagged Q1); `editCtxRef` holds `{row, col, rowIndex}`; focus re-fires via the L841 effect after `beginEdit` — Tab navigation gets re-focus for free; `leafColumns` (flattened, rendered order) is the Tab order.
- **Handle**: `removeRow` composes core `removeRowFromList` (returns original ref on no-match → cheap no-op), prunes selection typed-key, commits via `commitRowList`; `SelectionModel` has `deselect`/`set`/`rebaseToProp` for controlled mode.

**Proposed design** (react-only, additive):

- **a) `lazyLoad`** — internal `lazyChildren: Map<string, Row[]>` + `lazyLoading: Set<string>`; `treeGetChildren` consults the map first then `getSubRows`, still wrapped by `withSortedChildren`; leaf-with-lazyLoad renders the caret (`data-iris-tree-loading` + disabled + `aria-label` via new `treeSelect.loading` key); `load(children)` stores + expands only when non-empty; try/catch keeps a throwing load retryable.
- **b) `removeRows`** — composes `removeRowFromList` per key (no core change); no-ops ignored; selection pruned with the _actually-removed_ set via one `selModel.set()`; `onDataChange` fires exactly once; all-no-op = zero side effects.
- **c) Tab nav** — shared `moveEdit(±1)` in all three editor keydowns: commit → scan `leafColumns` skipping non-editable → `beginEdit` neighbor; stops at first/last editable (no wrap); validation failure prevents default and stays in-cell; no neighbor → commit + close with plain default Tab.

**File map**: `props.ts` (+14), `Table.tsx` (+90), core i18n + zh locale (+1 each), 2 new test files + `table-ops.test.tsx` extension; core logic untouched. **31-case test plan** + 10 open questions (async-validation × Tab, expandAll × lazy leaves, tree/lazy children outside `liveData` write-back, duplicate keys, select blur race, etc.).
