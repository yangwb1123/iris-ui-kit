**Verdict: PASS** — written to `/home/u1/iris-ui/docs/vxe-grid/batch-ap-review.md`.

## Summary

Inspected commit `60b3bc5c` against baseline + adapt docs and verified every claim against code.

**1. Selection summary — all checked:**

- Gated by `selectable === 'multi' && selectionSummary === true && displaySelection.length > 0` (Table.tsx:5422), default `false`
- Count text via `table.selectionSummary` with same `{count}` interpolation as header; clear button `data-iris-selection-clear` → shared `rebaseToProp(); selModel.clear()` path
- Sums use the **exact** summary-row material: same `aggregate(selectedRows, getCellValue, 'sum')`, same `aggregateAccuracy` rounding guard, same `String(value)`; only `sum` ops; hidden when no selection

**2. Export selection — all checked:**

- `bodyDataRef.current.filter(selected.has(rowKeyOf(row, i)))` — bodyData order (test proves ≠ selection order, and sort+filter ordering)
- Hidden columns excluded via `viewColumnsRef` (leafColumns from visibility-filtered displayColumns); empty selection → `''`; formula shadow rows materialized; byte-identical shape to `exportCurrentViewCsv`

**3. Hygiene — all checked:**

- Purely additive: **zero deleted lines** in Table.tsx; no new core API
- `check:manifest` up to date; `selectionSummary` native-extracted (propCount 133, 155×4)
- Core framework-free grep empty; all new styles use `--iris-*` tokens with fallbacks (audit:tokens warning set identical to parent commit); en + zh i18n keys match

**Verification:** react test 1965 ✅ · typecheck ✅ · lint 0 errors ✅ · audit:tokens no new warnings ✅ · audit:security clean ✅ · check:manifest ✅ · core 1354 ✅ · plugin-locale-zh 6 ✅

**3 informational findings (non-blocking):** adapt report says 12 tests but there are 13; summary requires the toolbar container to exist (matches baseline design); file count 9+2 exceeds the "≤4 files" cap (acknowledged, baseline itself required it).

No source files were modified.
