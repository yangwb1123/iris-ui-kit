Done. Batch BZ (表格状态导出导入) is complete and committed.

## Files changed (2 commits)

**`e6e01ae5`** — `feat(table): grid 批 BZ——表格状态导出导入（iris 独有）`

- `packages/react/src/primitives/table/types.ts` — `IrisTableHandle` + `exportStateJson(): string` / `importStateJson(json: string): boolean` (after `exportComparisonCsv`)
- `packages/react/src/primitives/table/Table.tsx` — 4 touch points + 2 ref mirrors: memo `persistState || views` gate removed (bare table exports `'{}'`); `query` collection unconditional (persist save loop has no `query` key → byte-identical); `persistSnapshotRef`/`applyViewSnapshotRef` latest-snapshot mirrors; `exportStateJson` strips `multiSortState` at the boundary; `importStateJson` parses with try/catch + non-object guard → `false`, else reuses `applyViewSnapshot` (query-first, pageSize `onPageChange(1,size)` + exactly one request, expandedKeys full-set replace) → `true`
- `packages/react/src/primitives/table/props.ts` — `tableRef` JSDoc (rewritten to scanner convention: `/**` / content / ` */` own lines)
- `packages/react/src/primitives/table/usePersistState.ts` — comment erratum (unconditional collector → `hasConfig` gate semantics)
- `test/state-export-import.test.tsx` (NEW) — **12 tests, 483 lines**
- `packages/manifest/manifest.json` — regenerated (165 props / 31 events unchanged)
- `docs/vxe-grid-comparison.md` — persistState row + build-status append

**`80317603`** — `docs/vxe-grid/batch-bz-adapt.md` (adapt report)

## Tests added (12)

Export structure (9 spec keys with owning callbacks / lazy gating / bare table `'{}'`) · import application (per-callback original values + expanded DOM / query-first ordering / pageSize single request / expandedKeys full-set replace / byte-identical round-trip) · invalid (5 bad inputs → `false` zero callbacks / corrupted-piece laziness / ineligible lazily skipped still `true` / multiSortState superset imports but never exports).

## Verification (all ✅)

- core test **1517/1517** · react typecheck **clean** · react test **2385/2385** (2373→2385) · react lint **0 errors** (1 pre-existing complexity warning, verified via stash)
- `iris-ui-spec.py --mode all` → **0 violations** · `gen:manifest` regenerated + committed
- Constraints: core/vue/solid/svelte/styles.ts untouched · react-only · additive · 4 source files + 1 test · test ≤500 lines

## What is left

- Runner's review/gate stage; working-tree `DECISIONS.md`/`batch-by-gate.md` changes are BY-gate leftovers (untouched, folded in later)
- vue/solid/svelte alignment deferred (react-only scope, per baseline)
