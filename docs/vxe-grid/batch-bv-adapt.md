Done — batch BV complete and committed (`30c936d2`).

## Report

**Batch BV: 导出比较 `exportComparisonCsv`（iris 独有）** — implemented per baseline, zero drift.

### Files changed (4 source + tests + docs)

| File                                            | Change                                                                                                                                                                      |
| ----------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/react/src/primitives/table/types.ts`  | +1 `exportComparisonCsv: () => string` (single-line method after `exportVersionCsv`)                                                                                        |
| `packages/react/src/primitives/table/Table.tsx` | 4 touches: `toCsv` import · module const `COMPARISON_DIFF_KEY` + pure fn `buildComparisonCsv` · 3 ref mirrors (`compareDiffRef`/`compareWithRef`/`rowKeyRef`) · handle item |
| `packages/core/src/i18n.ts`                     | +1 `table.compare.diff` en `Diff`                                                                                                                                           |
| `packages/plugin-locale-zh/src/core/index.ts`   | +1 zh `差异` (en→zh parity test gates it)                                                                                                                                   |
| `test/export-comparison-csv.test.tsx` (new)     | **14 tests, 306 lines** (≤500)                                                                                                                                              |
| `docs/vxe-grid-comparison.md`                   | 4 places: compareWith row append · new 独有表行 · 构建状态 · 测试计数 2306→2320                                                                                             |
| `docs/vxe-grid/batch-bv-adapt.md` (new)         | adapt report                                                                                                                                                                |
| manifest                                        | regenerated — **no diff** (handle + i18n invisible, propCount 161/eventCount 30 unchanged, as predicted)                                                                    |

### Implementation

- Diff rows = **current view** (`filteredDataRef`, same source as `exportCurrentViewCsv`) rows with status ∈ {removed, changed} **in view order** + snapshot-only `added` rows **at the tail in snapshot order**; unchanged rows excluded.
- Marker column `__iris_diff` prepended (i18n header; values = English literals).
- Changed cells export `maskedOld → maskedNew` (**mask before composition**, `exportRaw` bare; formula columns don't self-composite, materialized from pristine data — 3-pass shadow pipeline + core `toCsv` RFC-4180/OWASP).
- Empty semantics: no `compareWith`/`rowKey` → `''`; zero diff → header only (two states).

### Verification — all ✅

- core test **1517/1517** · react typecheck **clean** · react test **2320/2320** (+14) · react lint **0 errors** (1 pre-existing complexity warning)
- spec `--mode all` **0 violations** (1415 files) · prettier clean · manifest regenerated + committed

### Left

Runner's pending review/gate stage; vue/solid/svelte alignment deferred (react-only scope — the shared `diffRows` core is already framework-free).
