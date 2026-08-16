## Report — 批 CR：列汇总条（iris 独有）

**Committed**: `76f94398 feat(table): grid 批 CR——列汇总条（iris 独有）`

### Files changed (4 source + manifest + docs)

| File                                                         | Change                                                                                                                                                                                                                              |
| ------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/react/src/primitives/table/props.ts`               | `columnTotals?: boolean` after `editPreview` (propCount 177→178)                                                                                                                                                                    |
| `packages/react/src/primitives/table/styles.ts`              | `COLUMN_TOTALS_STYLE` — token-only strip (surface bg, FNR-bar border language)                                                                                                                                                      |
| `packages/react/src/primitives/table/Table.tsx`              | destructure + `columnTotalsValues` useMemo (zero new state, chartNumericColumns precedent) + strip JSX after toolbar close / before FNR bar (`data-iris-column-totals` + per-leaf `data-iris-column-totals-cell`, selection spacer) |
| `packages/react/src/primitives/table/column-totals.test.tsx` | **NEW — 12 tests, 186 lines** (≤500 ✓)                                                                                                                                                                                              |
| `packages/manifest/{manifest.json,llms.txt}`                 | regenerated via `gen:manifest` (propCount 178, eventCount 31 unchanged, 155×4)                                                                                                                                                      |
| `docs/vxe-grid-comparison.md`                                | 批 CR row in 「iris 独有」section + 构建状态 tail                                                                                                                                                                                   |
| `docs/vxe-grid/{batch-cr-baseline.md, batch-cr-adapt.md}`    | stage bookkeeping (baseline was pre-written by spec stage)                                                                                                                                                                          |

### Implementation (spec-literal)

Bar renders **directly below the toolbar** (nextElementSibling, before `data-iris-table` root), independent of toolbar visibility (FNR precedent). Only `summary === 'sum'` columns get values via the **exact summary-row pipeline**: `aggregate(bodyData, r => getCellValue(r, col), 'sum')` → `aggregateAccuracy` rounding gate (batch P's single rounding point, out-of-range ignored) → `renderSummary ?? String` — so footer parity is byte-for-byte. Formula columns funnel through the `getCellValue` choke point; null/NaN/Infinity rows skipped; empty body → core aggregate returns 0 → strip shows `0`. Non-sum columns render empty placeholders; shared `gridTemplateColumns` keeps tracks aligned. Five documented fiats: no label/i18n, fixed-track alignment, no column virtualization, no pinned sticky, empty-body `0`.

### Verification (all ✅)

- `@iris-ui-kit/core test`: **1559/1559** (core untouched; framework-free grep 0)
- `@iris-ui-kit/react typecheck`: clean
- `@iris-ui-kit/react test`: **2582/2582** (2570 + 12 new)
- `@iris-ui-kit/react lint`: **0 errors** (1 pre-existing IrisTable complexity warning, unchanged)
- spec script: **0 violations** (1416 files)
- `check:manifest`: up to date

### What is left

- Review stage (`batch-cr-review.md`) then gate stage, per the batch pipeline.
- Note: 3 heavy virtual-scroll tests (Cascader/CommandPalette/Tree) are flaky under full parallel load (pre-existing, pass in isolation) — unrelated to this change.
