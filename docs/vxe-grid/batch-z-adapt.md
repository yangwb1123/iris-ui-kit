Batch Z complete and committed (`19172e15`), working tree clean.

## Report

**Situation**: A prior attempt timed out but left a near-complete implementation uncommitted. I audited it, fixed the remaining issues, and ran all gates.

**Files changed** (3 source files + 2 test files + generated/docs):

| File                                                                                  | Change                                                                                                                                                                           |
| ------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/vue/src/primitives/table/Table.ts`                                          | +1059/−151 — all four batch-Z features + complexity extraction                                                                                                                   |
| `packages/vue/src/primitives/table/types.ts`                                          | +43 — `IrisTableFilterOption`, `IrisTableFilterValues`, `IrisTableContextMenuParams`, `IrisTableContextMenuConfig` (named, exported) + `filterable`/`filterOptions` column props |
| `packages/vue/src/primitives/table/index.ts`                                          | +4 type exports                                                                                                                                                                  |
| `parity-z.test.ts`                                                                    | **337 lines / 10 tests** (≤500 ✓) — row edit mode + contextMenu                                                                                                                  |
| `parity-z-filter-tree.test.ts`                                                        | **412 lines / 11 tests** (≤500 ✓) — filter panel + lazy tree                                                                                                                     |
| `manifest.json`/`llms.txt`, `batch-z-adapt.md`, `batch-z-baseline.md`, `DECISIONS.md` | regenerated/stage docs                                                                                                                                                           |

**Implemented** (all 4, additive, core + react/solid/svelte untouched):

1. **Row edit mode** — session `Map<cellId, {draft,error}>` extending the bespoke singleton cell machinery with a shared `writeCellValue` commit core (cell mode byte-identical); `data-iris-row-editing`; per-cell Enter/blur commit; Escape cancels the row; clicking another row commits current first (sync validation failure blocks the switch); async-validate-then-cancel drops the commit.
2. **contextMenu** — named `IrisTableContextMenuConfig`/`Params` (React shape); body leaf cells only; fake cursor-rect virtual anchor cast at call site (**zero `useFloating` hook changes**), flip/shift off, Esc/outside/scroll close, Teleport to body, disabled items inert.
3. **filterValues** — trigger in leaf+grouped headers (`stopPropagation`, sort intact) → checkbox panel (`data-iris-filter-panel`, i18n `filterConfirm`/`filterClear`); OR-match channel AND-ed with text filters; remote proxy comma-joins via `mergeFilterValues(mergeFormFilters(...), filterValues)` (React parity).
4. **lazyLoad** — vue has `getSubRows` tree support, so implemented: caret on childless rows, `lazyLoading` set, `lazyChildren` map wins over `getSubRows`, epoch-guarded cache drop on data re-feed (stale callbacks dropped).

**Verification (all green)**: typecheck ✓ · vue test **1531/1531** (21 new) ✓ · lint **0 errors, 0 warnings** (extracted `buildRowSessionContent`/`buildCellEditContent`/`buildTreeIndent`/`editorInputStyle`/`editorErrorVNode` to keep `renderRow` ≤70 complexity) ✓ · `iris-ui-spec.py --mode all --json` → **0 violations** ✓ · `gen:manifest` regenerated (155 components, 4×155 aligned) ✓ · prettier clean ✓.

**Solid/Svelte handoff** (next rounds, mirror react-reference semantics): (1) `editConfig.mode='row'` session map + shared commit core; (2) `contextMenu` with the fake-cursor-rect cast (no hook changes needed); (3) `filterValues` panel + OR-match + remote comma-join; (4) `lazyLoad` only if the adapter has tree support, else document skip. Pre-existing scanner artifact carried over: vue function props truncate in the manifest at `=>` (`lazyLoad`, `onFilterValuesChange`, `spanMethod`, …); named-interface props (`contextMenu`, `columnDrag`) parse fully.
