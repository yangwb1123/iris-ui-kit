All done. Final verification passed across the board.

## Report

**Files changed** (4 source + 1 test + generated):

| File                                                     | Change                                                                                                                                              |
| -------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/solid/src/primitives/table/IrisTable.tsx`      | +~1050 net: all 5 features + `mergeFilterValues`, `TableContextMenu`, `TableFilterPanel` (module-level)                                             |
| `packages/solid/src/primitives/table/props.ts`           | +47: `rowDrag`/`columnDrag`/`editConfig`/`contextMenu`/`filterValues`/`onFilterValuesChange`/`tableRef`/`onDataChange` (single-line function props) |
| `packages/solid/src/primitives/table/types.ts`           | +75: 6 named exported interfaces/types + column `filterable`/`filterOptions`                                                                        |
| `packages/solid/src/primitives/table/index.ts`           | +6 type exports                                                                                                                                     |
| `packages/solid/src/primitives/table/parity-ab.test.tsx` | **new — 499 lines / 13 tests** (≤500 ✓)                                                                                                             |
| `packages/manifest/manifest.json` + `llms.txt`           | regenerated via `gen:manifest` (155 components, 4×155 aligned; new props/types in solid contract ✓)                                                 |

**Implemented** (all 5, additive — core/react/vue/svelte untouched):

1. **rowDrag/columnDrag** — core `createSortable` bridges, press → threshold → rects-once → closestCenter → end reorder; row ids ride on `data-iris-row-drag-handle` (empty `data-iris-table-row` attr untouched); local rows signal + `onDataChange` + `onReorder`; drag track in all 5 grid sites.
2. **editConfig.mode 'row'** — per-column session Map (own draft/error signals) over the existing bespoke edit machinery; Enter commits that column, **Escape cancels all**, row switch commits (sync validation failure blocks), Tab moves, `data-iris-row-editing` highlight.
3. **contextMenu** — virtual cursor anchor (fresh object per open → solid `useFloating` re-runs, no seq token), Esc/outside/scroll close, disabled inert, header excluded, portal to body.
4. **filterValues** — leaf-only header trigger (stopPropagation) → floating checkbox panel with 确认/清除 (keyed Show re-seeds draft per open); **OR-match** in the filter memo AND-ed with text; **remote comma-join** in proxy initial/form/effect merges.
5. **tableRef handle** — `loadData` (local rows, no query), `reloadData` (override cleared + refetch), `commitProxy`, `getProxyInfo`, `clearSort`, `clearFilter`; mount-time closures stay fresh via solid getters.

**Verification (all green)**: solid typecheck ✓ · solid test **953 + 34 SSR passed** (13 new) ✓ · lint **0 errors** ✓ · prettier clean ✓ · `iris-ui-spec.py --mode all --json` → **0 violations** (1405 files) ✓ · `gen:manifest` ✓ · manifest package tests 69 ✓ · solid build ✓.

**Handoff list (next batch)**:

1. `layouts.pager` positioning + `layouts.form/toolbar` hidden.
2. lazyLoad tree (epoch fix + reactive loading set) — per batch-AB baseline.
3. `editor: 'select'` row-mode editors (row sessions currently text/number; cell mode shares the same simplification).
4. Context menu has no arrow-key navigation (matches react parity — mouse-first).
5. Pre-existing scanner `=>`-truncation artifact on function props (named-interface props parse fully).
