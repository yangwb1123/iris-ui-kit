Baseline written to `/home/u1/iris-ui/docs/vxe-grid/batch-ac-baseline.md` (526 lines). `git status` confirms the only change is the new doc — no source files touched.

**Key findings baked in:**

1. **Svelte is the last adapter missing this surface** — no proxyConfig/formConfig/multiSort/columnVisibility/filters/seq/spanMethod/toolbar/pager (react 5002-line reference has all; vue batches D/I/L/M/X/Y and solid batch AA already shipped). All raw material exists in core: `createRemoteTableSource` (with the mutually-exclusive `sorts` channel, page-reset-on-sort/filter-change, `setParams` dedupe), `seedFormValues`/`buildFormValues`/`mergeFormFilters`, i18n keys (`table.formSubmit/formReset/total/refresh/export`), plus the existing `toStore`/subscribe→`$state` bridge pattern (selection/cellRange).

2. **Svelte-idiomatic design**: presence-keyed controller in `$effect` (guard `if (proxyRef) return` so inline `proxyConfig` identity never destroys/recreates; cleanup only on absent/unmount — react `hasProxy`/vue `cfg===undefined` parity, no mounted latch needed since effects don't run in renderToString); `proxyState` naming avoids the AGENTS.md `$state`/`state` collision; non-generic component keeps svelte-check runes intact.

3. **Framework deltas flagged**: pager renders **svelte** `IrisPagination` props (`value`/`total`/`pageSize`/`onchange`, not react's `onValueChange`) and `IrisSelect` for pageSizes; `spanMethod` uses a pure `buildSpanPlan` `$derived.by` pass in tableUtils.ts instead of react/vue's render-time ref mutation — correct across virtual-window boundaries and unit-testable; form re-seed keyed on the field-signature `$derived` VALUE (inline identity never wipes input).

4. **Explicit-track layout**: svelte (like vue) uses explicit grid tracks, so `seq` must land in 7 sites with verified line refs — `lead` L332, `gridTemplate` L341, flat header L729/L763, grouped header L664/L691, `bodyRow` L924/L993, summary L1119/L1129, `colTrack` L579.

5. **Tests**: 6 new vitest files (~37 cases) mirroring react's proxy-config/form-config/multi-sort/proxy-seq/toolbar shapes, using `waitFor` from `@testing-library/svelte` (tour-test precedent); 8 open questions for adapt (prop naming `onUpdate*` vs react-parity, proxy-mode edit write-back, toolbar scope, seqMethod, span×virtual, filterValues deferral, layouts, file budget).
