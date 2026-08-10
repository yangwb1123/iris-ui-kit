All verification gates pass. Final state:

## Report

**Files changed (3 source/test + 2 runner bookkeeping docs):**

| File                                                                | Change                                                                                              |
| ------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `packages/react/src/primitives/table/props.ts`                      | `removeRows` on `IrisTableHandle` (single line) + `lazyLoad` prop on `IrisTableProps` (single line) |
| `packages/react/src/primitives/table/Table.tsx`                     | Batch-J logic: `removeRows` handle op, Tab edit navigation, lazy tree                               |
| `packages/react/src/primitives/table/test/lazy-tree-batch.test.tsx` | **New**, 392 lines (≤500), 12 tests                                                                 |
| `docs/vxe-grid/batch-j-baseline.md`, `docs/vxe-grid/DECISIONS.md`   | Runner-generated artifacts (baseline + audit log), untouched by me                                  |

**Implementation:**

1. **Batch delete** — `removeRows(keys)`: composes core `removeRowFromList` per key, skips missing keys, prunes selection of the actually-removed set (`rebaseToProp` + per-key `selModel.toggle`), `commitRowList` + `onDataChange` exactly once; all-no-op is zero side effects.
2. **Tab edit navigation** — shared `moveEditOnTab(e, dir)` reads `editCtxRef` (row/col/rowIndex), commits, scans `leafColumns` in order skipping non-editable columns, `beginEdit` on the neighbor; validation failure prevents default and stays in-cell; no neighbor → commit + close with default Tab. Wired into all three editors (text input, select, textarea) before Enter/Escape.
3. **Lazy tree** — `lazyLoad(row, load)` prop; `lazyChildrenRef` map wins over `getSubRows` in the `flattenTree` `getChildren` (still wrapped by `withSortedChildren` for sorting); `lazyLoading` as `useState<Set>` drives the caret spinner (`data-iris-tree-loading` + token-driven keyframes in the singleton stylesheet); loading prevents double-load; `load(children)` caches + expands when non-empty; throwing loads stay retryable.

**Bugs found & fixed during verification:**

- Test harness passed the ref via a prop named `ref` — React strips it as a special prop, so the handle never attached (fixed: renamed to `tableRef`).
- **Real implementation bug**: handle methods run against the mount-time closure, so `displaySelection` was stale and selection pruning never fired after selection changed. Fixed with a `displaySelectionRef` mirror (also corrects the pre-existing `removeRow` prune path); no core changes.
- Row-count assertion counted the header row (`data-iris-table-row="header"`) — narrowed selector.

**Verification (all green):**

- `typecheck` ✓ (0 errors)
- `test` ✓ **1618/1618 passed** (12 new batch-J tests)
- `lint` ✓ **0 errors** (1 pre-existing complexity warning on base commit, unchanged)
- `iris-ui-spec.py --mode all` ✓ **0 violations** (1403 files scanned)

**Unfinished items:** none. All three features complete with tests.
