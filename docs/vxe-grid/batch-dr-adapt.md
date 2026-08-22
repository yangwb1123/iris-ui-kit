Done. Final report:

## 批 DR：单元格编辑快捷键 — complete ✅

**Situation:** the spec (`editKeys?: Array<'F2'|'Enter'|'Space'>`, default F2, config extends, custom-key test) was already implemented at HEAD within the `61ec5418` adapter-alignment batch — the baseline anchored it line-by-line. This session (adapt, following the DQ precedent) **verified every anchor** and **closed the baseline's flagged gap ② plus the DR-specific halves of ①** with 4 new dedicated tests, then committed.

**Verified anchors at HEAD:** prop `props/editing.ts:234` (single-line literal union, named `IrisTableEditingProps`) · gate `Table.tsx:4399-4416` `handleConfiguredEditKey` (keyboardNavigation/editable/locked/readonly/formula guards, `preventDefault` + `beginEdit`) · F2 always retained (`!matches && e.key !== 'F2'` → return) · Space three-way match · mount `Table.tsx:8078/8082-8083` first-handler + `defaultPrevented` short-circuit.

**Files changed (5, commit `e4761d0c`):**

- `packages/react/src/primitives/table/test/batch-dl-dt.test.tsx` — +4 DR cases + `focusCell` helper, 423→493 lines (≤500; hook filesize check passed at 99%)
- `docs/vxe-grid/batch-dr-adapt.md` — real adapt report
- `docs/vxe-grid/DECISIONS.md` — adapt record appended
- `docs/vxe-grid/batch-dq-gate.md` + `batch-dr-baseline.md` — pre-existing stage evidence, committed together
- `gen:manifest` regenerated: **zero diff** (155×4 components / 86 tokens — test-only change, scanner surface untouched)

**Tests added (+4):** F2 retained under `editKeys={['Enter']}` · Space `{key:' ',code:'Space'}` three-way match · `editKeys={[]}` keeps only F2 (Enter inert) · inert without `keyboardNavigation` / on non-editable columns.

**Verification:** core **1597/1597** (104 files, untouched) · react typecheck **clean** · react **2826/2826** (246 files; batch-dl-dt **21/21**) · lint **0 errors** (2 pre-existing Table.tsx complexity warnings) · spec scan **0 violations** · worktree clean.

**Left:** locked/readonly/formula guards shared with AN F2 path (covered in locked-cells/cell-permission suites); observation ③ (DR shadows AN F2 when both enabled) is behavior-identical by design, untested; `editKeys` remains react-only per batch scope.
