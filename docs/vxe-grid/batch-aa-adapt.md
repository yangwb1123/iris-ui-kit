Batch AA complete and committed, working tree clean.

## Report

**Situation**: A prior attempt timed out but left a near-complete, uncommitted implementation. I audited it end-to-end, fixed the remaining issues (test size, assertions, formatting), and ran all gates.

**Files changed** (4 source files + 1 test file + generated/docs):

| File                                                               | Change                                                                                                                                                                                                                                                |
| ------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/solid/src/primitives/table/IrisTable.tsx`                | +867/−92 — all six batch-AA features (see below)                                                                                                                                                                                                      |
| `packages/solid/src/primitives/table/props.ts`                     | +47 — `multiSort`/`multiSortState`/`defaultMultiSort`/`onMultiSortChange`/`seq`/`seqStartIndex`/`seqMethod`/`spanMethod`/`columnVisibility`/`onColumnVisibilityChange`/`filters`/`onFiltersChange`/`formConfig`/`toolbar`/`proxyConfig`/`pagerConfig` |
| `packages/solid/src/primitives/table/types.ts`                     | +127 — 9 named exported interfaces (`IrisTableFormField`/`FormConfig`/`ProxyQueryParams`/`ProxyConfig`/`PagerConfig`/`SeqMethodParams`/`SpanMethodParams`/`ToolbarButton`/`ToolbarBatch`/`ToolbarConfig`) + `filterMethod` column prop                |
| `packages/solid/src/primitives/table/index.ts`                     | +10 type exports                                                                                                                                                                                                                                      |
| `parity-aa.test.tsx`                                               | **492 lines / 23 tests** (≤500 ✓)                                                                                                                                                                                                                     |
| `manifest.json`/`llms.txt`, `batch-aa-baseline.md`, `DECISIONS.md` | regenerated/stage docs                                                                                                                                                                                                                                |

**Implemented** (all 6, additive; core + react/vue/svelte untouched — solid bridge only):

1. **columnVisibility / filters / seq / seqStartIndex** — `displayColumns` reference-preserving memo feeds header/body/summary; substring case-insensitive filter memo (col `filterMethod` override; empty values inactive; `mergeFormFilters` form-merge); seq column lands in all 5 grid sites (gridTemplate, flat+grouped header placeholders, body `renderRow`, summary, `colTrack`) so alignment holds with detail/selection/grouped/virtualized combos.
2. **spanMethod** — `(params) => { rowspan?; colspan? }`; per-pass occupied `Set` rebuilt on `bodyEntries` reference change (Solid `<For>` never accumulates stale coverage); colspan extends the grid track (`grid-column-end: span n`), rowspan drops covered cells (each row is its own grid container).
3. **proxyConfig** — `createRemoteTableSource` created once per proxy _presence_ (inline prop identity never destroys it), `onCleanup` destroy; signals for data/total/loading/error via store subscribe; remote sort/filter/page flow through `setParams` (dedupe prevents double-requests); pager renders solid `IrisPagination` (`page`/`total`/`pageSize`/`onChange` — solid API, not react's) + `pagerConfig` total/pageSizes; edit write-back patches the local page copy until refetch (react `liveData` parity); `autoLoad:false` honored; loading/error/retry UI driven by controller state.
4. **multiSort** — react-exact cycle (append asc → desc → remove), click-order list state (controlled/uncontrolled), chained comparator (`compareValues` + per-column `sorter`), sequence-number badge on non-primary columns, `onMultiSortChange`, remote multi-sort passes the full `sorts` list.
5. **formConfig** — draft/applied two-state (keystrokes never query), field-signature re-seed (inline prop identity never wipes input), text/select fields, i18n submit/reset labels, local submit filters + proxy submit `setParams({ filters: merged, page: 1 })`; reset re-queries (forced refetch when params unchanged).
6. **toolbar** — title / refresh (proxy re-queries) / export / custom buttons / batch action (visible only with multi-selection, receives keys).

**SSR-safety**: presence-keyed controller lifecycle via `createMemo` + `createEffect`/`onCleanup` — effects never run in `renderToString`, so the first fetch is SSR-safe by construction (no vue-style `mounted` latch needed).

**Verification (all green)**: typecheck ✓ · solid test **939+34** (23 new in parity-aa) ✓ · lint **0 errors** ✓ · prettier clean ✓ · `iris-ui-spec.py --mode all --json` → **0 violations** ✓ · `gen:manifest` regenerated (155 components, 4×155 aligned; new props + named types in manifest) ✓.

**Batch AB handoff** (solid, mirror react-reference semantics):

1. `filterValues` checkbox panel (react has it; solid `filters` is text-only — OR-match channel AND-ed with text filters, remote comma-join via `mergeFilterValues`).
2. `layouts` pager positioning (`pagerConfig` done; `layouts?.pager === 'hidden'` not).
3. Settings panel / column settings; `spanMethod` × columnVirtualization windowed coverage is untested (occupied-set logic is window-safe but no E2E proof).
4. `multiSort` + `filterMethod` manifest truncation at `=>` is a pre-existing scanner artifact (carried over from vue/react); named-interface props (`proxyConfig`/`formConfig`/`toolbar`/`pagerConfig`) parse fully.
5. Pre-existing: `TableHeader.tsx`/`TableBody.tsx`/`TableRow.tsx` are orphaned (unused, unexported) — decide delete vs wire.
