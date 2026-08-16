Done. Batch CO (表格时间线导出) is complete and committed.

## Files changed (2 commits)

**`ddb1cb97`** — `feat(table): grid 批 CO——表格时间线导出（iris 独有）`

1. `packages/react/src/primitives/table/types.ts` — `IrisTableHandle.exportTimelineCsv(): string` (single-line prop + single-line JSDoc, after `exportComparisonCsv`)
2. `packages/react/src/primitives/table/Table.tsx` — handle method inline after `exportComparisonCsv`: `auditEnabledRef` gate → `''`; else core `toCsv` over `audit.list()` → spec-literal 6 cols `time,type,rowKey,column,old,new` (`time` = `formatClock(new Date(e.at))` HH:MM:SS local, byte-identical to the audit panel time cell; undefined → `''`, numbers bare, strings RFC-4180 + OWASP via toCsv; empty ring → header only). Zero new imports.
3. `packages/react/src/primitives/table/export-timeline-csv.test.tsx` (NEW) — **9 tests, 186 lines**
4. `docs/vxe-grid-comparison.md` — new iris-独有 row + build-status append

**`e36676e7`** — adapt report `docs/vxe-grid/batch-co-adapt.md`

## Tests added (9, content-only)

fail-closed `''` · single edit (time regex + exact rowKey/column/old/new) · newest-first ring order · insert structural row (trailing 3 empty cells) · on-but-empty ring → header only + after `clearAuditLog` → header only · RFC-4180 quoting (comma + doubled quote) · OWASP `=` neutralization · numeric bare values · per-field same-source vs `getAuditLog` (time via `formatClock`).

## Counts

react 2535 → **2544** (+9) · core 1559 unchanged · manifest 155 components / 174 props / 31 events **unchanged** (handle is manifest-invisible, 批 BF/BV 先例)

## Verification (all ✅)

- core test **1559/1559** · react typecheck **clean** · react test **2544/2544** (two consecutive clean runs) · react lint **0 errors** (1 pre-existing complexity warning, verified via stash)
- `iris-ui-spec.py --mode all --json` → **0 violations**
- `pnpm gen:manifest` regenerated → **zero diff** (nothing to commit)

## What is left

- Runner's review/gate stage; working-tree `DECISIONS.md`/`batch-cn-gate.md` are BY-gate leftovers (untouched); `batch-co-baseline.md` is the runner's baseline file
- vue/solid/svelte alignment deferred (react-only scope per baseline)
