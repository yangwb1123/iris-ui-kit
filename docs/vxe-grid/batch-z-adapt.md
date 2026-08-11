Batch Z complete and committed (vue parity round 3).

## Report

**Situation**: A prior adapt attempt timed out but left a nearly-complete implementation in the working tree (Table.ts + types.ts + index.ts + an over-limit 702-line test file). This session audited it against the baseline, fixed the remaining issues (lint complexity extraction, test file split), ran all gates, and committed.

**Files changed** (4 source/test files + generated/docs):

| File                                                             | Change                                                                                                                                                                                |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/vue/src/primitives/table/Table.ts`                     | +947/−149 — all batch-Z features + render-complexity extraction (edit builders, tree caret)                                                                                           |
| `packages/vue/src/primitives/table/types.ts`                     | +41 — `IrisTableFilterOption`, `IrisTableFilterValues`, `IrisTableContextMenuParams`, `IrisTableContextMenuConfig` (all named, exported), + `filterable`/`filterOptions` column props |
| `packages/vue/src/primitives/table/index.ts`                     | +4 — exports all four new types                                                                                                                                                       |
| `packages/vue/src/primitives/table/parity-z.test.ts`             | new, **336 lines / 10 tests** (≤500 ✓) — row edit mode + contextMenu                                                                                                                  |
| `packages/vue/src/primitives/table/parity-z-filter-tree.test.ts` | new, **406 lines / 11 tests** (≤500 ✓) — filterValues panel + lazy tree                                                                                                               |
| `packages/manifest/{manifest.json,llms.txt}`                     | regenerated via `pnpm gen:manifest`                                                                                                                                                   |
| `docs/vxe-grid/{batch-z-baseline.md,DECISIONS.md}`               | stage docs                                                                                                                                                                            |

**What was implemented** (all additive, core untouched, vue-only — react untouched as reference):

1. **editConfig.mode `'row'`** — extends the bespoke singleton-session edit machinery into a reactive `Map<cellId, {draft, error}>` session map (`rowSessions`) with a shared commit core (`writeCellValue`, extracted from `finishCommit` so both modes write back to proxy liveData identically). Cell mode stays byte-identical. Semantics (React parity): a click on any cell of a row with editable columns opens every editable column's editor (`data-iris-row-editing` on the row); Enter/blur commits THAT column only (per-cell session, async `editRules` validated with cancel-drops-commit); Escape cancels the whole row; clicking another row commits the current row's open sessions first — a sync validation failure keeps the row open with the error visible. Clicking an already-committed column reopens just that column.
2. **contextMenu** — `contextMenu?: { items(params), onSelect(key, params) }` with exported `IrisTableContextMenuConfig`/`IrisTableContextMenuParams` (same shape as React). Body leaf cells only (header/seq/selection/expand/summary/footer excluded). The vue `useFloating` hook has no virtual-anchor type, but `computePosition` accepts `VirtualElement` at runtime — the call site casts a fake cursor-rect element (`getBoundingClientRect` at `clientX/Y`), exactly like React, so **zero hook changes**. `flip/shift` off (cursor-anchored), `useDismiss` (Esc/outside pointer-down) + capture-phase scroll close, `Teleport` to body, `data-iris-table-context-menu(-item)`, disabled items inert (`disabled` + `aria-disabled`).
3. **filterValues** — `filterable` + `filterOptions` per column; controlled `filterValues`/`onFilterValuesChange`; header trigger (`data-iris-filter-trigger`, `stopPropagation` so sort still works, leaf + grouped headers) → floating panel (checkbox list, `data-iris-filter-panel`, i18n `table.filterConfirm`/`table.filterClear`/`table.filter`). `filteredData` gains an OR-match channel (checked set vs raw `String(value)`) AND-ed with the text-filter channel. Remote-filter proxy: checked sets comma-join into the query `filters` map via `mergeFilterValues(mergeFormFilters(...), filterValues)` — matching React's `mergeFilterValues` exactly; form submit/reset/watch all route through it.
4. **lazyLoad** (vue HAS tree support: `getSubRows`/flattenTree/expansion) — `lazyLoad?: (row, load) => void`; childless rows render a caret when configured; first expand calls it, `lazyLoading` set drives `data-iris-tree-loading` (double-click no-op, throwing load retryable), `load(children)` seeds `lazyChildren` map (wins over `getSubRows`) and expands. A data-source-reference watch clears cache + bumps an epoch; stale in-flight callbacks are dropped (React M2 parity). Loaded lazy rows toggle collapse/expand like normal parents.

**Verification (all green)**:

- `typecheck` ✓ · `test` **1531/1531** (21 new batch-Z tests) ✓ · `lint` **0 errors, 0 warnings** ✓ (extracted `buildRowSessionContent`/`buildCellEditContent`/`buildTreeIndent`/`editorInputStyle`/`editorErrorVNode` to keep `renderRow` complexity under the 70 limit)
- `iris-ui-spec.py --mode all --json` → **0 violations** ✓
- `gen:manifest` regenerated ✓

**Solid/Svelte handoff** (next parity rounds, mirror this batch's react-reference semantics):

1. `editConfig.mode='row'` — session map + per-cell commit core; both adapters have cell edit already.
2. `contextMenu` — floating at cursor; solid/svelte `useFloating` bridges need the same fake-cursor-rect cast (no hook changes).
3. `filterValues`/`filterable`/`filterOptions` — panel + OR-match channel + remote comma-join.
4. `lazyLoad` — only if the adapter has tree/getSubRows support; else document as skipped.
5. Pre-existing scanner artifact (carried over): vue function props containing `=>` truncate in the manifest at the arrow (`spanMethod`, `onDataChange`, `onRetry`, `getSubRows`, now also `lazyLoad`/`onFilterValuesChange` — equally affected; named-interface props like `contextMenu`/`columnDrag` parse fully).
