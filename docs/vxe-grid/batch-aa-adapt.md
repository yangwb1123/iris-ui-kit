Batch AA complete and committed (`ad9f301c`), working tree clean.

## Report

**Situation**: A prior attempt timed out but left a near-complete uncommitted implementation. I audited it end-to-end, fixed the remaining issues (test file over the 500-line limit, a wrong assertion, prettier reflow), and ran all gates.

**Files changed** (4 source files + 1 test file + generated/docs):

| File                                                | Change                                                                                                                          |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `packages/solid/src/primitives/table/IrisTable.tsx` | +867/−92 — all six batch-AA features                                                                                            |
| `packages/solid/src/primitives/table/props.ts`      | +47 — 16 additive props (multiSort/seq/spanMethod/columnVisibility/filters/formConfig/toolbar/proxyConfig/pagerConfig families) |
| `packages/solid/src/primitives/table/types.ts`      | +127 — 9 named exported interfaces + `filterMethod` column prop (manifest-scanner hygiene ✓)                                    |
| `packages/solid/src/primitives/table/index.ts`      | +10 type exports                                                                                                                |
| `parity-aa.test.tsx`                                | **492 lines / 23 tests** (≤500 ✓)                                                                                               |

**Implemented** (all 6, additive; core/react/vue/svelte untouched — solid bridge only):

1. **columnVisibility/filters/seq/seqStartIndex** — reference-preserving `displayColumns` memo; substring filter memo with `filterMethod` override; seq lands in all 5 grid sites (flat+grouped headers, body, summary, colTrack).
2. **spanMethod** — occupied-set merge rebuilt per render pass; colspan extends track, rowspan drops covered cells.
3. **proxyConfig** — `createRemoteTableSource` once per proxy presence, `onCleanup` destroy; signals for data/total/loading/error; remote sort/filter/page via `setParams` (dedupe); solid `IrisPagination` + `pagerConfig`; edit write-back keeps local edits until refetch (react `liveData` parity); `autoLoad:false` honored.
4. **multiSort** — react-exact append/cycle/remove, chained comparator, order badges, controlled/uncontrolled, remote `sorts` list.
5. **formConfig** — draft/applied two-state, signature-based re-seed, submit→`setParams({filters, page:1})`/local, reset re-queries.
6. **toolbar** — title/refresh(proxy re-query)/export/buttons/batch-with-keys.

**Verification (all green)**: solid typecheck ✓ · solid test **939+34 passed** (23 new) ✓ · lint **0 errors** ✓ · prettier clean ✓ · `iris-ui-spec.py --mode all --json` → **0 violations** (1405 files) ✓ · `gen:manifest` regenerated (155 components, 4×155 aligned) ✓.

**Batch AB handoff**: (1) `filterValues` checkbox panel + OR-match/remote comma-join; (2) `layouts.pager` positioning; (3) settings/column-settings panel; (4) spanMethod×columnVirtualization windowed coverage untested; (5) orphaned `TableHeader/Body/Row.tsx` — delete vs wire; (6) pre-existing `=>`-truncation scanner artifact on function props (named-interface props parse fully).
