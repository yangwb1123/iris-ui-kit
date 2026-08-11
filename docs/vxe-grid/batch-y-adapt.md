Batch Y complete and committed (`6ef3dc36`).

## Report

**Situation**: Two prior adapt attempts timed out but left a nearly-complete implementation in the working tree. This session audited it line-by-line against the baseline + core APIs, fixed the remaining issues, ran all gates, and committed.

**Files changed** (4 source/test files + generated/docs):

| File                                                 | Change                                                                                                                                                                                    |
| ---------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/vue/src/primitives/table/Table.ts`         | +605/−47 — all batch-Y features                                                                                                                                                           |
| `packages/vue/src/primitives/table/types.ts`         | +48 — `IrisTableColumnVisibility`, `IrisTableSpanMethodParams`, `IrisTableSpan`, `IrisTableColumnDrag`, `IrisTableRowDrag`, `IrisTableProxyInfo`, `IrisTableExpose` (all named, exported) |
| `packages/vue/src/primitives/table/index.ts`         | +7 — exports all new types                                                                                                                                                                |
| `packages/vue/src/primitives/table/parity-y.test.ts` | new, **385 lines / 10 tests** (≤500 ✓)                                                                                                                                                    |
| `packages/manifest/{manifest.json,llms.txt}`         | regenerated via `pnpm gen:manifest` (155 components)                                                                                                                                      |
| `docs/vxe-grid/{batch-y-baseline.md,DECISIONS.md}`   | stage docs                                                                                                                                                                                |

**What was implemented** (all additive, core untouched, vue-only):

1. **columnVisibility** — prop + `update:columnVisibility` emit; `displayColumns` computed (reference-preserving: `props.columns` when prop absent) feeds header/body/summary via `leafColumns`.
2. **filters** — substring case-insensitive over `displayColumns`, `''` ignored, AND-combined with formConfig values (`mergeFormFilters`); remote-filter proxy mode pushes merged map via `setParams`.
3. **seq/seqStartIndex** — explicit leading track (`data-iris-table-cell="__seq"`, before selection), header/summary placeholders, `gridTemplate`/`colTrack`/`pinnedOffsets` generalized via `leadTrackCount()`.
4. **spanMethod** — `resolveSpan` + occupy-set cleared once per body pass; `gridRowEnd`/`gridColumnEnd: span n` on spans, covered cells skipped.
5. **columnDrag** — core `createSortable` bridge (press → 4px threshold → closestCenter over ref-synced rects → drop → `onReorder`); grouped headers NOT supported (documented).
6. **rowDrag** — `data-iris-row-drag-handle` (id as value) + container pointer handlers; reorders through proxy `liveData` / local `localRowsOverride` (new ref, cleared on parent `data` re-feed) + fires `onDataChange` + `onReorder`.
7. **expose** — `loadData` (no query) / `reloadData` / `commitProxy` / `getProxyInfo` bridging `useTableProxy` (`createRemoteTableSource`).

**Verification (all green)**:

- `typecheck` ✓ · `test` **1510/1510** (10 new parity-y) ✓ · `lint` **0 errors** ✓
- `iris-ui-spec.py --mode all --json` → **0 violations** ✓
- `gen:manifest` regenerated, `check:manifest` + `check:docs-reference` up-to-date ✓
- prettier formatted; pre-commit hook (filesize + change budget) passed (only non-blocking warnings)

**Batch Z handoff** (from DECISIONS.md, unchanged):

1. `filterValues` OR-match
2. `col.filterMethod`
3. `seqMethod`
4. proxy cumulative seq
5. `columnOrder` / toolbar column panel (fires the already-declared `update:columnVisibility` emit)
6. footer spans (footerMethod/footerData)
7. Pre-existing scanner artifact: vue function props containing `=>` truncate in the manifest at the arrow (`spanMethod`, `onDataChange`, `onRetry`, `getSubRows` — all equally affected, named-interface props like `columnDrag`/`rowDrag` parse fully)
