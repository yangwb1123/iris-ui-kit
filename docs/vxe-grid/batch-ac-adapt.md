All gates green. Final state of the work:

## Report

**Task**: svelte adapter vxe-grid batch AC parity (core round) — all 7 areas implemented, tested, verified.

### Files changed (source, exactly 4) + tests

| File                                                     | Change                                                                                                                                                                                                                                    |
| -------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/svelte/src/primitives/table/types.ts`          | +12 named exported interfaces (`IrisTableFormField/FormConfig/ProxyQueryParams/ProxyQueryResult/ProxyConfig/PagerConfig/SeqMethodParams/SpanMethodParams/Span/ToolbarButton/ToolbarBatch/ToolbarConfig`) + `IrisTableColumn.filterMethod` |
| `packages/svelte/src/primitives/table/props.ts`          | +`multiSort/multiSortState/defaultMultiSort/onUpdateMultiSort/seq/seqStartIndex/seqMethod/spanMethod/columnVisibility/filters/formConfig/toolbar/proxyConfig/pagerConfig` (additive only)                                                 |
| `packages/svelte/src/primitives/table/IrisTable.svelte`  | proxy controller (`$effect` presence-keyed, `proxyState` naming), form, toolbar, seq in all 7 explicit-track sites, span plan, multi-sort, pager                                                                                          |
| `packages/svelte/src/primitives/table/index.ts`          | re-exports the 12 new types                                                                                                                                                                                                               |
| `packages/svelte/src/primitives/table/parity-ac.test.ts` | **new — 412 lines, 17 tests** (≤500)                                                                                                                                                                                                      |

Plus required artifacts: regenerated `manifest.json`/`llms.txt`, `docs/vxe-grid/batch-ac-adapt.md` (evidence), `DECISIONS.md` entry.

### Tests added (17, in one new file)

columnVisibility hiding · substring filters (case-insensitive, empty-ignored, `filterMethod` override) · seq with `seqStartIndex` + composition with multi-selection · spanMethod colspan/rowspan occupied-set merge · proxyConfig: loading→rows+total, pager page change re-query, `autoLoad:false` + toolbar-refresh re-query, remoteSort re-query, edit write-back kept until refetch · multiSort: append/cycle/remove click order + chained comparator + seq badges + remote `sorts` channel · formConfig: local submit/reset, proxy submit → merged filters + page 1 · toolbar: title/export/buttons/batch (gated on selection, receives keys).

### Verification (all green)

- `typecheck` — **0 errors** (5 warnings pre-existing in `IrisCompose.svelte`)
- `test` — **125 files / 916 tests + 31 hydration** pass (17 new parity-ac)
- `lint` — **0 errors**; `build` (svelte-package) ✓; prettier ✓
- `iris-ui-spec.py --mode all --json` — **0 violations** (1405 files)
- `gen:manifest` — **155 components × 4 frameworks aligned**, svelte contract extracts cleanly (no bogus `params` prop; `spanMethod => '(params: IrisTableSpanMethodParams) => IrisTableSpan | null'`)

### Notable fixes during the round

- **Manifest scanner hygiene**: prettier had forced `spanMethod`/`query` multi-line, which the line-based scanner mis-parsed (`'('` type + bogus `params` prop). Fixed via named result types `IrisTableSpan` + `IrisTableProxyQueryResult` (vue's pattern) — every function prop now single-line ≤100 chars, prettier-stable.
- Svelte rules honored: `proxyState` (never `state`), non-generic component, `svelte-ignore state_referenced_locally` markers on intentional seed sites.

### Handoff for batch AD

1. **filterValues / filter panel** (`onFilterValuesChange`, `FilterPanel`) — react batch-P surface; `filters` prop + `filterMethod` + formConfig covers local filtering for now.
2. **layouts** (`layouts.pager: 'hidden'` etc.) — react batch-P surface.
3. Optional: dedicated proxy-seq cumulative + `seqMethod` render tests (behavior exists, untested by the 17 cases).
