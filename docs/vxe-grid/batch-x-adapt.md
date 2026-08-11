All done — zero drift after regeneration.

## Batch X complete

**Note on provenance:** the previous batch-X attempt timed out leaving a nearly-complete, unverified implementation in the working tree. I reviewed it end-to-end, verified against the React reference, restructured it to meet the hard constraints, and shipped it.

### Files changed (2 commits, 4 non-test source files + 2 test files + manifest + docs)

| File                                                       | Change                                                                                                                                                                                                                                                                                                               |
| ---------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/vue/src/primitives/table/Table.ts`               | +814/−72: inlined `useTableProxy` bridge (core `createRemoteTableSource` wired only — no controller logic in vue), proxy data pipeline with `liveData` edit write-back, form/toolbar/pager section builders (extracted from render), multiSort seq badge + aria-sort, loading/error/retry driven by controller state |
| `packages/vue/src/primitives/table/types.ts`               | +93: 7 named exported interfaces (`IrisTableProxyConfig`, `IrisTableProxyQueryParams`, `IrisTableFormConfig/Field`, `IrisTableToolbarConfig/Button/Batch`) — inline-object hygiene                                                                                                                                   |
| `packages/vue/src/primitives/table/index.ts`               | +7: exports all new types (scanner hygiene)                                                                                                                                                                                                                                                                          |
| `packages/vue/src/primitives/table/useTableSort.ts`        | +119: multiSort (`multiSortState`/`cycleMultiSort`/`setMultiSort`) + exported pure `buildMultiSortComparator`; single mode byte-identical                                                                                                                                                                            |
| `parity-x.test.ts` (new)                                   | 373 lines, **13 tests** (proxy 8: loading→rows, error+retry, remote sort re-query, page change, autoLoad=false, edit write-back, local sort, late proxy arrival; form 5)                                                                                                                                             |
| `parity-x-multi.test.ts` (new)                             | 343 lines, **14 tests** (multiSort 9 incl. 4 pure comparator; toolbar 5: buttons order+fire, batch gating, single-mode exclusion, export/refresh)                                                                                                                                                                    |
| `manifest.json`/`llms.txt`                                 | regenerated: vue IrisTable props 20→26, all 6 new props present, `source: native`                                                                                                                                                                                                                                    |
| `docs/vxe-grid/batch-x-adapt.md`, `DECISIONS.md`, baseline | handoff report                                                                                                                                                                                                                                                                                                       |

### Verification (all pass, on committed state)

- `typecheck` ✓ · `test` **1496/1496** (147 files, +27) ✓ · `lint` **0 errors, 0 warnings** ✓ (previous attempt's complexity warning eliminated via section extraction)
- `iris-ui-spec.py --mode all --json` **0 violations** ✓
- `gen:manifest` regenerated + committed; re-run confirms **zero drift** ✓
- Working tree clean; each test file ≤500 lines; ≤4 non-test files (composable inlined to comply)

### Batch Y handoff (in `batch-x-adapt.md`)

1. **`pageSizes`** (pagerConfig parity) — pager is page-only; documented in code
2. **toolbar `onImport`** · 3. **`columnSettings`** · 4. **`seq`** (React batch-L parity) · 5. **zoom** (documented SKIP — overlay stylesheet + window listeners) · 6. **form field `date`/`datetime`** · 7. **layout variants** (`layout`/`fold`)
3. Note: don't move the new prop pairs into `controlProps.ts` — the manifest scanner doesn't follow the `...tableControlProps` spread, which would hide them from the generated contract.
