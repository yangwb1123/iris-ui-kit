Baseline complete. Deliverable: **`/home/u1/iris-ui/docs/vxe-grid/batch-bf-baseline.md`** (99 lines) — the only file created (`git status` confirms the pre-existing BE-stage `M`/`??` entries untouched; zero source files modified).

## What's in the baseline

**Exact design** (every anchor verified against current code):

- **Type**: `IrisTableHandle.exportVersionCsv: (index: number) => string` in types.ts, after `restoreVersion` (:579) — handle method → no manifest propCount change, no i18n, no props.ts (the `versionHistory` prop already exists, props.ts:617-631), no core.
- **Impl**: Table.tsx handleRef after `restoreVersion,` (:3631) — `history.get(index)` (the batch-BA ref-once ring controller, Table.tsx:1827-1831) → `undefined` → `''`; else the **exact batch-AP `exportSelectionCsv` pipeline** (:3514-3521): `exportCsv(withComputedFormulaCells(rows, viewColumnsRef.current, formulaTablesRef.current), viewColumnsRef.current)` — formula columns materialized on shadow rows, masks applied (batch AY), hidden columns excluded. Zero core changes (controller's `get` already exists).
- **Spec's 对比 answered with a table**: same serializer/column set/masks/OWASP neutralization; different row source (ring PRE-change snapshot vs filtered live view) and empty semantics (`''` for unknown/trimmed index vs never-empty view). Locked invariant: **after `restoreVersion(i)`, `exportVersionCsv(i) === exportCurrentViewCsv()` byte-identical** — the comparison test's core assertion. Formula materialization uses current formula state (cross-table refs read live tables) — documented approximation, not a bug (same as restore-then-export).
- **No UI**: panel gets no export button (deliberate non-goal fiat 6 — spec is handle-only; restore + `exportCurrentViewCsv` covers the panel path).

**File map**: 2 small edits (types.ts, Table.tsx) + 1 new test file `export-version-csv.test.tsx`; props.ts / core / VersionHistoryPanel / i18n untouched.

**Test plan**: 8 cases — 导出历史版 (spec core, #1-2 with per-commit pre-change semantics), 越界返回空 (#3, plus ring-trimmed `max: 1` #4), 惰性无 prop (#5), 对比 exportCurrentViewCsv + post-restore equality (#6), mask consistency (#7), formula materialization + hidden-column exclusion (#8). Plus 8 numbered fiats for gate arbitration.
