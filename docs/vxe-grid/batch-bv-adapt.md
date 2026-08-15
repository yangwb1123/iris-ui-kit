Batch BV complete. Remaining uncommitted files (`DECISIONS.md`, `batch-bu-gate.md`, `batch-bv-baseline.md`) are pre-existing pipeline state from the prior gate/baseline stages — untouched.

## Report

**Batch BV: 导出比较 `exportComparisonCsv`（iris 独有）** — implemented per baseline, zero drift.

### Files changed (4 source + tests + docs)

| File                                            | Change                                                                                                                                                                                                                                          |
| ----------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/react/src/primitives/table/types.ts`  | +1 `exportComparisonCsv: () => string` (after `exportVersionCsv`; single-line method, single-line JSDoc)                                                                                                                                        |
| `packages/react/src/primitives/table/Table.tsx` | 4 touches: `toCsv` import · module const `COMPARISON_DIFF_KEY` + pure fn `buildComparisonCsv` (after `csvRangeCell`) · 3 ref mirrors `compareDiffRef`/`compareWithRef`/`rowKeyRef` (after `bodyDataRef`) · handle item after `exportVersionCsv` |
| `packages/core/src/i18n.ts`                     | +1 `'table.compare.diff': 'Diff'` (after `table.compare.tooltip`)                                                                                                                                                                               |
| `packages/plugin-locale-zh/src/core/index.ts`   | +1 `'table.compare.diff': '差异'` (en→zh parity test gates it)                                                                                                                                                                                  |
| `test/export-comparison-csv.test.tsx` (new)     | **14 tests, 306 lines** (≤500)                                                                                                                                                                                                                  |
| `docs/vxe-grid-comparison.md`                   | 4 places: compareWith 独有行 append · new 独有表行 `exportComparisonCsv` · 构建状态批列表 +批 BV · 测试计数 2306→2320                                                                                                                           |
| `docs/vxe-grid/batch-bv-adapt.md` (new)         | this report                                                                                                                                                                                                                                     |
| `packages/manifest/{manifest.json,llms.txt}`    | regenerated — **no diff** (handle + i18n both invisible; propCount 161 / eventCount 30 unchanged, as baseline predicted)                                                                                                                        |

### Implementation

- Diff rows = **current view** (`filteredDataRef` — same source as `exportCurrentViewCsv`) rows with status ∈ {removed, changed} **in view order** + `compareWith`-only `added` rows **at the tail in snapshot order** (batch AU documented: no render slot); unchanged rows excluded.
- Marker column `__iris_diff` prepended (reserved key; header = i18n `table.compare.diff` en `Diff`/zh `差异`; values = English literals added/removed/changed — machine-readable).
- Changed cells export `maskedOld → maskedNew` composite (**mask before composition** — batch AY default mask never leaks a bare value through the composite; `exportRaw` keeps both sides bare); formula columns do NOT self-composite and materialize from **pristine** data (a changed input's composite never leaks into a dependent formula — 3-pass shadow-row pipeline: marker → `withComputedFormulaCells` → batch-AY mask → composite overwrite, then core `toCsv` for RFC-4180 + OWASP neutralization).
- Empty semantics: no `compareWith`/`rowKey` (render memo null) → `''`; feature on but zero diff → header only (two states).
- Handle runs against the mount-time closure → per-render ref mirrors (`compareDiffRef` mirrors the render memo — zero recompute, constructed-identical to the rendered view; key extraction = bare `row[rowKeyField]` same as core `diffRows`, no rowId fallback).

### Tests added (14)

① changed row marker + composite · ② removed exports current (live) value · ③ added exports snapshot value · ④ unchanged rows excluded · ⑤ lazy `''` without compareWith · ⑥ lazy `''` with empty rowKey · ⑦ identical snapshots → header only · ⑧ marker column first + i18n zh title · ⑨ hidden changed column excluded · ⑩ mask both composite sides + exportRaw bare · ⑪ formula materializes from pristine data · ⑫ row order (view order + snapshot tail) · ⑬ multiple changed columns + null → empty side · ⑭ filtered-view exclusion (removed row filtered out is not exported; added still from unfiltered snapshot)

### Verification — all ✅

- core test **1517/1517** (i18n + diff-rows suites)
- react typecheck **clean** · react test **2320/2320** (+14, 2306→2320 = baseline prediction) · react lint **0 errors** (1 pre-existing IrisTable complexity warning)
- spec `--mode all` **0 violations** (1415 files)
- `gen:manifest` regenerated — no manifest diff; prettier clean on all touched files

### Left

Runner's pending review/gate stage; vue/solid/svelte alignment deferred (react-only scope — `exportComparisonCsv` is a react handle method, `diffRows` core is already shared).
