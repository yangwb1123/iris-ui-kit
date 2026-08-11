# Batch X — Vue table vxe-grid parity: proxyConfig / formConfig / multiSort / toolbar

Batch X complete. Working tree committed.

## Report

**Commits:**

- `feat(table): vxe-grid 批 X——proxyConfig/formConfig/multiSort/toolbar（vue）`
- `docs(table): 批 X adapt 报告`

**Files changed (9):**

| File                                                                    | Change                                                                                                                                                                                                                                                                                             |
| ----------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/vue/src/primitives/table/Table.ts`                            | +742/−72: inlined `useTableProxy` bridge (core `createRemoteTableSource`), proxy data pipeline + liveData edit write-back, form/toolbar/pager section builders (extracted from render for lint complexity), multiSort header seq badge + aria-sort, loading/error/retry driven by controller state |
| `packages/vue/src/primitives/table/types.ts`                            | +93: `IrisTableProxyConfig`/`IrisTableProxyQueryParams`/`IrisTableFormConfig`/`IrisTableFormField`/`IrisTableToolbarConfig`/`IrisTableToolbarButton`/`IrisTableToolbarBatch` — all named exported interfaces (no inline object params)                                                             |
| `packages/vue/src/primitives/table/index.ts`                            | +7: export the new types from the table barrel (manifest scanner hygiene)                                                                                                                                                                                                                          |
| `packages/vue/src/primitives/table/useTableSort.ts`                     | +119: multiSort mode (`multiSortState`/`cycleMultiSort`/`setMultiSort`/`multiSortComparator`) + exported pure `buildMultiSortComparator`; single mode byte-compatible                                                                                                                              |
| `packages/vue/src/primitives/table/parity-x.test.ts`                    | new — 373 lines, **13 tests** (proxyConfig 8 + formConfig 5)                                                                                                                                                                                                                                       |
| `packages/vue/src/primitives/table/parity-x-multi.test.ts`              | new — 343 lines, **14 tests** (multiSort 9 + toolbar 5)                                                                                                                                                                                                                                            |
| `packages/manifest/manifest.json` / `llms.txt`                          | regenerated — vue IrisTable props 20→26 (additive), 155 components × 4 frameworks unchanged                                                                                                                                                                                                        |
| `docs/vxe-grid/DECISIONS.md`, `batch-x-baseline.md`, `batch-x-adapt.md` | docs                                                                                                                                                                                                                                                                                               |

**Key implementation notes:**

- **proxyConfig** — controller created ONCE per proxy **presence** (inline-object identity churn safe), torn down on scope dispose; `state` flows controller → `shallowRef` via store subscribe (same pattern as selection/expansion bridges). Proxy rows feed `liveData` (a ref); committed inline edits write through to the local copy until the next refetch replaces it (React liveData parity). Loading/error/retry reuse the existing `error → loading → empty` state rows, now driven by controller state when a proxy is present. Pager (stateless `IrisPagination`, `modelValue`/`total`/`pageSize`) renders below the body; page change → `setParams({page})` + `proxyConfig.onPageChange`. **pageSizes NOT in batch X** (documented in `IrisTableProxyConfig`/pager comment — deferred to batch Y).
- **formConfig** — draft/applied two-state keyed on the field signature (`key=defaultValue` join) so inline formConfig identity churn never wipes user input; submit strips empties via core `buildFormValues` → `onSearch` → proxy `setParams({filters: mergeFormFilters({}, values), page: 1})`; reset restores defaults + re-queries (setParams no-op → forced `refetch`). Local (non-remoteFilter) mode introduces the Vue table's **first filter memo** (`filteredData` before sort) — substring case-insensitive, column-keyed; remote tables never hide rows client-side. i18n: existing `table.formSubmit`/`table.formReset`/`table.refresh`/`table.export` keys, zero core changes.
- **multiSort** — `cycleMultiSort` append asc → desc → remove; `buildMultiSortComparator` chains per-column comparators in click order (first non-zero wins, stable); seq badge (`data-iris-sort-seq`, small muted number) on non-primary columns only; dual emits `update:multiSortState` + `multiSortChange` (React-parity listeners); remoteSort pushes the full `sorts` list (single mode keeps `sort` — the two channels are mutually exclusive).
- **toolbar** — title + spacer + refresh + export + batch + custom buttons, in that order (matches React DOM markers); batch gated by `selectable === 'multi' && displaySelection.length > 0`; refresh re-queries in proxy mode. All styling `var(--iris-*)` only.
- **Constrain compliance** — 4 non-test files touched (useTableProxy composable inlined into `Table.ts` to stay within the ≤4 file budget); each test file ≤500 lines; `iris-ui-spec.py --mode all` **0 violations**; lint 0 errors **and** 0 warnings (section builders extracted from render — the previous attempt's complexity warning is gone); function-type props single-line, all inline object params are named exported interfaces exported from the table index (manifest scanner hygiene verified by regenerated manifest: vue IrisTable 26 props, all 6 new props present, `source: native`).

**Verification (all pass):**

- `pnpm --filter @iris-ui-kit/vue typecheck` ✓
- `pnpm --filter @iris-ui-kit/vue test` — **1496/1496** (147 files; +27 parity tests) ✓
- `pnpm --filter @iris-ui-kit/vue lint` — **0 errors, 0 warnings** ✓
- `iris-ui-spec.py --mode all --json` — **0 violations** ✓
- `pnpm gen:manifest` — regenerated, manifest tests 69/69 ✓

## Handoff — batch Y

Explicitly deferred (per baseline; none are regressions):

1. **proxyConfig `pageSizes`** (vxe pagerConfig parity) — pager is page-only today; needs `IrisTablePagerConfig` type + size-selector UI next to the pager + pageSize change → `setParams({ pageSize, page: 1 })`.
2. **toolbar `onImport`** (vxe toolbar import parity) — file-input button + parse callback.
3. **toolbar `columnSettings`** (vxe toolbar custom-config parity) — column show/hide dropdown.
4. **toolbar `seq`** (vxe seq-config parity) — cumulative sequence numbers across pages (`(page-1)*pageSize + rowIndex + 1`); React has `seq`/`seqStartIndex` already (batch L).
5. **toolbar **zoom** (batch U on React) — **documented SKIP** in baseline: overlay stylesheet + window listeners; needs a dedicated batch.
6. **formConfig `type: 'date' | 'datetime'`** fields (vxe formConfig items parity) — text/select only today.
7. **Layout variants** (vxe toolbarConfig `layout`/form `fold` etc.) — current sections are a fixed column flow; vertical stacking is a follow-up.
8. Optional: move the 6 new controlled/uncontrolled prop pairs into `controlProps.ts` — note the manifest scanner does **not** follow the `...tableControlProps` spread, so that would hide them from the generated contract (keep them in `Table.ts` props unless the scanner gains spread support).
