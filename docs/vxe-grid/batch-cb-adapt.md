Batch CB complete — all gates green on the committed state.

## Report

**Commits** (2, following CA/BZ convention):

- `e3401b31` — `feat(table): grid 批 CB——最近筛选（iris 独有）` (13 files, +659/−9)
- `30ce5381` — `docs(table): batch CB adapt report`

**Files changed** (per baseline file map, exactly):

| File                                                  | Change                                                                                                                                                                                                                                                                                 |
| ----------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/core/src/recent-filters.ts`                 | **NEW** — framework-free `createRecentFilters`: ring of 10 (createAuditLog mold, `ensureBound` trim), `record(key, values)` → `{ key, values, ts }` newest-first, same key+values-**set** de-dupes to top (MRU, ts re-bumped); `list/clear/subscribe/getVersion/depth`; deep-copy list |
| `packages/core/src/index.ts`                          | barrel: `createRecentFilters` + `RecentFilterEntry`/`RecentFilters`/`RecentFiltersOptions` (named exported interfaces)                                                                                                                                                                 |
| `packages/core/src/i18n.ts`                           | +1 key `table.recentFilters` = `Recent filters`                                                                                                                                                                                                                                        |
| `packages/plugin-locale-zh/src/core/index.ts`         | +1 key `table.recentFilters` = `最近筛选`                                                                                                                                                                                                                                              |
| `packages/react/src/primitives/table/props.ts`        | `recentFilters?: boolean` after `autoLink` (single-line prop, scanner JSDoc convention)                                                                                                                                                                                                |
| `packages/react/src/primitives/table/Table.tsx`       | import · destructure `recentFilters = false` · ref-once controller + `recentEnabledRef` gate · record point in `applyFilterValues` (non-empty only, controlled-irrelevant) · `applyRecentFilter` (apply + close) · panel props `recent`/`onApplyRecent`/`columns`                      |
| `packages/react/src/primitives/table/FilterPanel.tsx` | genericized `TableFilterPanel<Row>` + 3 props; recent section above options (`data-iris-filter-recent-title` + `data-iris-filter-recent={i}`); label = title + option labels, unknown column fail-inert; `--iris-*` tokens only                                                        |
| `packages/manifest/{manifest.json,llms.txt}`          | regenerated via `gen:manifest`                                                                                                                                                                                                                                                         |
| `docs/vxe-grid-comparison.md`                         | persistState row + 构建状态 line (comparison doc 2 处)                                                                                                                                                                                                                                 |

**Tests added**: 15 — core 8 (newest-first / MRU de-dupe / distinct sets / ring bound / deep copy / clear+notify / subscribe+unsubscribe / getVersion+depth) · react 7 (empty-set never recorded / section above options / cross-column apply + close / label resolution + raw fallback / re-confirm MRU bump / no-prop lazy / records without handler). Core test 87 lines, react test 278 lines (≤500 ✓).

**Counts**: core 1525→**1533** · react 2392→**2399** · manifest propCount 166→**167**, eventCount 31 unchanged · spec 0 violations (1415 files).

**Verification** (all ✅): core test 1533/1533 · react typecheck clean · react test 2399/2399 · react lint 0 errors (1 pre-existing complexity warning) · `iris-ui-spec.py --mode all` 0 violations · `gen:manifest` regenerated + committed (`check:manifest` up-to-date, `check:docs-reference`/`check:framework-parity` green) · react build + prettier clean. Zero changes: types.ts / styles.ts / core package.json (barrel-only, no subpath) / vue/solid/svelte.

**What is left**: runner's review/gate stage; working-tree `DECISIONS.md`/`batch-bz-gate.md`/`batch-ca-adapt.md` are prior-stage leftovers (untouched, per BZ precedent); baseline open questions deferred — O1 no explicit clear affordance for recent entries (ring self-prunes, bounded), O2 recent filters intentionally not added as persistState piece (session-local UX); vue/solid/svelte alignment deferred (react-only scope).
