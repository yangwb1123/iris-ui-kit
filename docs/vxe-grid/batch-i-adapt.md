All gates green. Final report:

## Batch I — implemented ✅

### Files changed (6 source + 2 new)

| File                                            | Change                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `packages/react/src/primitives/table/types.ts`  | `IrisTableEditor` + `'textarea'`; new exported `IrisTableFilterOption` interface + `IrisTableFilterValues` type; `formatter` (single line), `filterable`, `filterOptions` on `IrisTableColumn`                                                                                                                                                                                                                                                                           |
| `packages/react/src/primitives/table/props.ts`  | `filterValues` / `onFilterValuesChange` on `IrisTableProps` (documented controlled-only, matching the `filters` pattern)                                                                                                                                                                                                                                                                                                                                                 |
| `packages/react/src/primitives/table/Table.tsx` | formatter in cell chain (`render` → `html` → `formatter` → raw) + tooltip default uses formatted string; textarea editor (rows=3, Enter commit / Shift+Enter newline / Escape cancel, same aria surface); `mergeFilterValues` (comma-join) in all 4 proxy merge points incl. `initialParams`; OR-match in `filteredData` AND-ed with the text channel; trigger (both flat + grouped headers, `stopPropagation` on click/keydown so it never sorts) + panel state/anchors |
| `packages/react/src/primitives/table/index.ts`  | exports `IrisTableFilterOption`, `IrisTableFilterValues`                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `packages/core/src/i18n.ts`                     | `table.filterConfirm` / `table.filterClear` / `table.filter` (en)                                                                                                                                                                                                                                                                                                                                                                                                        |
| `packages/plugin-locale-zh/src/core/index.ts`   | same 3 keys (zh: 确定/清除/筛选)                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| **new** `table/FilterPanel.tsx`                 | 180 lines — batch-H ContextMenu pattern (`useFloating` + `useDismiss` + portal + capture-phase scroll-close), anchored to the real trigger button (`bottom-start`), draft checkbox state, 确认/清除 footer                                                                                                                                                                                                                                                               |
| **new** `test/filter-panel.test.tsx`            | 390 lines (≤500), 18 tests                                                                                                                                                                                                                                                                                                                                                                                                                                               |

_Note on "≤5 changed files": 6 changed is the minimum — the manifest-hygiene index.ts export and both i18n files (en + zh) are task-mandatory; 4 are implementation files._

### Verification

- `--filter @iris-ui-kit/react typecheck` ✅ (clean)
- `--filter @iris-ui-kit/react test` ✅ **147 files / 1605 tests** (18 new, all pass)
- `--filter @iris-ui-kit/react lint` ✅ **0 errors** (1 pre-existing complexity warning)
- `iris-ui-spec.py --mode all --json` ✅ **0 violations** (all styles `--iris-*` tokens only)
- Also green: core (1245 tests, i18n keys), plugin-locale-zh (6 tests incl. untranslated-keys coverage), manifest suite (67 tests); new props verified parseable by the manifest extractor (`formatter`/`filterable`/`filterOptions` captured on one line each)

### Test coverage (task list)

- **formatter**: formatted cell + tooltip; sort order unchanged by formatter; `render` wins over formatter; editing reads/commits raw value
- **textarea**: opens rows=3 seeded with raw; Enter commits; Shift+Enter inserts newline without commit; Escape cancels; blur commits
- **filter panel**: trigger shown; click opens panel without sorting (sortable+filterable); check + confirm filters rows OR-match; re-open pre-checks applied set; clear removes; text filter AND set combine; outside click + Escape close and discard draft; trigger `data-iris-filter-active` highlight; grouped header shows trigger only on leaves
- **remote**: initial query gets comma-joined `{ status: 'active,paused' }`; confirming re-queries with `{ filters: { status: 'active' }, page: 1 }`

### Unfinished

None — all three features + tests complete. Two documented decisions: `filterValues` is controlled-only (no internal state, same as `filters`); `filterOptions` uses the named exported `IrisTableFilterOption` interface (manifest hygiene). `.vinxi` artifacts and `DECISIONS.md` were already dirty before this task (baseline stage); `core/dist` was regenerated via the normal build (needed so tests see the new i18n keys — no hand-edits).
