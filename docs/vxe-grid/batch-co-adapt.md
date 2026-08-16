Done. Batch CO (表格时间线导出) is complete and committed.

## Files changed (2 commits)

**`ddb1cb97`** — `feat(table): grid 批 CO——表格时间线导出（iris 独有）`

- `packages/react/src/primitives/table/types.ts` — `IrisTableHandle.exportTimelineCsv(): string` (single-line prop, after `exportComparisonCsv`; single-line JSDoc — scanner hygiene)
- `packages/react/src/primitives/table/Table.tsx` — handle method inline after `exportComparisonCsv` (批 BZ 同款): `auditEnabledRef` gate → `''`; else core `toCsv` over `audit.list()` mapped to spec-literal 6 columns `time,type,rowKey,column,old,new` (time = `formatClock(new Date(e.at))`, HH:MM:SS local — byte-identical to the AuditPanel time cell; type/rowKey/column/oldValue/newValue verbatim; undefined → '', numbers bare, strings RFC-4180 + OWASP via toCsv). Empty ring → header only (toCsv's empty-body shape). Zero new imports (`toCsv`:73 / `formatClock`:20 already imported).
- `export-timeline-csv.test.tsx` (NEW) — **9 tests, 186 lines**
- `docs/vxe-grid-comparison.md` — new iris-独有 row (after `exportComparisonCsv`) + build-status append

**commit 2** — `docs/vxe-grid/batch-co-adapt.md` (this report)

## Tests added (9)

① fail-closed `''` (no `auditLog`, commits made, never throws) · ② single edit (time regex `^\d{2}:\d{2}:\d{2}$` + rowKey/column/old/new exact) · ③ newest-first ring order (2 commits, first line = newest) · ④ insert structural row → trailing three empty cells · ⑤ on-but-empty ring → header only + after `clearAuditLog` → header only · ⑥ RFC-4180 quoting (comma + embedded quote doubled) · ⑦ OWASP `=` neutralization (`'=cmd|calc`) · ⑧ numeric bare values (32/33 unquoted) · ⑨ per-field same-source with `getAuditLog` (time via `formatClock(new Date(at))`).

## Verification (all ✅)

- core test **1559/1559** (zero core changes)
- react typecheck **clean** · react test **2544/2544** (2535→2544, +9) · react lint **0 errors** (1 pre-existing complexity warning, verified via stash)
- `iris-ui-spec.py --mode all` → **0 violations**
- `pnpm gen:manifest` regenerated → **zero diff** (handle methods are manifest-invisible, 批 BF/BV 先例; 155 components / 174 props / 31 events unchanged)
- Constraints: core/vue/solid/svelte/styles/i18n untouched · react-only · additive · 3 source files + 1 test + 1 doc · test ≤500 lines (186)

## What is left

- Runner's review/gate stage; working-tree `DECISIONS.md`/`batch-cn-gate.md` changes are BY-gate leftovers (untouched, folded in later)
- vue/solid/svelte alignment deferred (react-only scope, per baseline)
