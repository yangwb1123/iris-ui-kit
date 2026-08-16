# 批 CR adapt report — 列汇总条（iris 独有）

## Summary

`columnTotals?: boolean` — a full-width horizontal strip directly below the
toolbar showing the sum of every `summary === 'sum'` column (Excel
status-bar parity; vxe has no equivalent). Aggregates over the current
body rows with the **exact summary-row value pipeline** (footer parity is
directly testable).

## Files changed (4 source + manifest + docs)

| File                                                         | Change                                                                                                                                                                                                                                   |
| ------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/react/src/primitives/table/props.ts`               | `columnTotals?: boolean` single-line prop after `editPreview` (propCount 177→178)                                                                                                                                                        |
| `packages/react/src/primitives/table/styles.ts`              | `COLUMN_TOTALS_STYLE` — token-only strip style (surface bg, FNR-bar border language, `--iris-font-size-sm`, weight 600)                                                                                                                  |
| `packages/react/src/primitives/table/Table.tsx`              | destructure + `columnTotalsValues` useMemo (chartNumericColumns precedent, zero new state) + strip JSX after toolbar close / before FNR bar (`data-iris-column-totals`, per-leaf cells `data-iris-column-totals-cell`, selection spacer) |
| `packages/react/src/primitives/table/column-totals.test.tsx` | **NEW — 12 tests, 186 lines** (≤500 ✓)                                                                                                                                                                                                   |
| `packages/manifest/{manifest.json,llms.txt}`                 | regenerated (177→178 props, eventCount 31 unchanged, 155×4)                                                                                                                                                                              |
| `docs/vxe-grid-comparison.md`                                | 批 CR row in 「iris 独有」section + 构建状态 tail                                                                                                                                                                                        |

## Tests added (12)

fail-closed default · bar render position (after toolbar, before root) ·
sum correctness (3×[10,20,30]→60) · sum-only gating (non-sum → empty
placeholder) · aggregate null/non-finite semantics (null/'abc'/Infinity
skipped) · formula-column funnel (`age * 2` sum = 120) · aggregateAccuracy
rounding + out-of-range ignore · **footer parity** (strip cell === summary
cell incl. `renderSummary`) · empty-data `0` + live update · selection-track
spacer · no-toolbar independence · token-style contract.

## Verification (all ✅)

- core test **1559/1559** (core untouched; framework-free grep 0)
- react typecheck **clean**
- react test **2582/2582** (2570→+12; 3 heavy virtual tests flaky under full
  parallel load, pass in isolation — pre-existing, unrelated)
- react lint **0 errors** (1 pre-existing IrisTable complexity warning)
- spec script **0 violations** (1416 files)
- `check:manifest` up to date

## What is left

- Review stage (batch-cr-review.md) then gate stage, per the batch pipeline.
- Known fiats (documented): no label/i18n; fixed-track alignment (same as
  batch M); strip ignores column virtualization; pinned columns not sticky;
  empty body → strip shows `0`.
