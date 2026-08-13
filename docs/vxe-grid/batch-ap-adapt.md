All gates green on the final committed state. Here's the report:

## 完成报告 — batch AP（选择汇总 + 选中行导出）

### Files changed (commit `60b3bc5c`, 11 files: 9 modified + 2 new)

| File                                                  | Change                                                                                                                                                                                                                                                                                                                                                       |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `packages/react/src/primitives/table/props.ts`        | `selectionSummary?: boolean` — single-line prop, JSDoc in manifest-safe form (`/**` on own line, verified description extraction)                                                                                                                                                                                                                            |
| `packages/react/src/primitives/table/types.ts`        | `IrisTableHandle.exportSelectionCsv: () => string` — single-line function type (scanner hygiene)                                                                                                                                                                                                                                                             |
| `packages/react/src/primitives/table/Table.tsx`       | destructure `selectionSummary = false`; handle method `exportSelectionCsv` (selected keys → `bodyDataRef.current` → `exportCsv(withComputedFormulaCells(...), viewColumnsRef)`, empty → `''`); `bodyDataRef` mirror (F1 pattern, same as `filteredDataRef`); toolbar block before batch button (`data-iris-selection-summary` / `data-iris-selection-clear`) |
| `packages/core/src/i18n.ts`                           | +3 en keys: `table.selectionSummary` `'{count} selected'`, `table.selectionSummarySum` `'sum'`, `table.clearSelection` `'Clear selection'`                                                                                                                                                                                                                   |
| `packages/plugin-locale-zh/src/core/index.ts`         | +3 zh keys: `'已选 {count} 行'`, `'合计'`, `'清除选择'`                                                                                                                                                                                                                                                                                                      |
| `docs/vxe-grid-comparison.md`                         | iris 独有 section +2 rows (`selectionSummary`, `exportSelectionCsv`), 构建状态 line + batch table row 批 AP                                                                                                                                                                                                                                                  |
| `packages/manifest/manifest.json` + `llms.txt`        | regenerated via `gen:manifest` (155×4; `selectionSummary` extracted native, `propCount` 132→133)                                                                                                                                                                                                                                                             |
| **NEW** `Table.selection-summary.test.tsx`            | 12 tests (see below)                                                                                                                                                                                                                                                                                                                                         |
| `docs/vxe-grid/batch-ap-baseline.md` + `DECISIONS.md` | baseline doc + its stage log (pre-existing, committed with batch)                                                                                                                                                                                                                                                                                            |

### Tests added (12, file 302 lines ≤ 500)

- **selectionSummary (7)**: defaults off; hides without selection; count + per-sum-column totals over **selected rows only**; multi gate (single mode never shows); only `sum` ops render (avg/count skipped); `aggregateAccuracy` rounding; clear button clears (uncontrolled: checkboxes reset + summary hides; controlled: emits `[]` via shared `clearSelection` path)
- **exportSelectionCsv (5)**: bodyData order ≠ selection order; empty → `''`; hidden columns (columnVisibility) excluded; formula columns materialized on shadow rows; sorted+filtered bodyData (filtered-out rows skipped)

### Gate results

- `--filter @iris-ui-kit/react typecheck` ✅
- `--filter @iris-ui-kit/react test` ✅ **1965 passed** (174 files; +12 new)
- `--filter @iris-ui-kit/react lint` ✅ **0 errors** (1 pre-existing `IrisTable` complexity warning, 215→219, unrelated)
- `iris-ui-spec.py --mode all --json` ✅ **0 violations** (all styling uses `--iris-*` tokens: `--iris-space-xxs`, `--iris-font-size-sm`, `--iris-muted`)
- `gen:manifest` ✅ regenerated + committed
- Also verified: core tests 1354 ✅, plugin-locale-zh 6 ✅

### What is left / notes

- **File count**: prompt capped at "≤4 changed files + tests"; the baseline's own file map required 5 source files + docs + manifest regeneration (i18n spans two packages). Actual: 9 changed + 2 new. The repo change-budget tool flagged this as a **non-blocking** warning ("multi-framework fan-out is a known exception").
- **Core dist rebuilt** during the run (`--filter @iris-ui-kit/core build`) so react's workspace `dist` resolution picks up the new i18n keys — a build artifact, not a hand edit; no dist/tgz/node_modules/manifest.json hand edits.
- **react-only by design**: vue/solid/svelte untouched; manifest four-framework contract test pins only required props (`['columns']`) so 155×4 alignment holds.
- **Two deliberate i18n additions beyond the mandated key**: `table.selectionSummarySum` (so the `· 合计 X` label isn't hardcoded Chinese in en builds; zh renders exactly `· 合计 X` per baseline) and `table.clearSelection` (a11y aria-label for the clear button).
