Done. Baseline written to `/home/u1/iris-ui/docs/vxe-grid/batch-dn-baseline.md` (5.7KB, verification-style) — the only file changed; no source/manifest/docs touched (the `DECISIONS.md` / `batch-dm-gate.md` ` M` entries pre-existed).

## Baseline summary — 批 DN：列头统计（iris 独有）

**Exact design** — spec `headerStats?: boolean`（数值列表头小统计 count/avg，muted 小字，逐列表头内嵌，与列汇总条区分）verified as fully shipped at HEAD `473bcbc2`, per-line anchored:

- **Prop**: `props/advanced.ts:200-202` + destructure default `false` at `Table.tsx:287`
- **计算核心**: `Table.tsx:3953-3967` — `headerStatsByKey` useMemo over **current body** (`:3951` flatTree/filteredData, not raw input); `getCellValue` (shared choke point, `table-constants.ts:57`); keeps only `number && Number.isFinite`; **zero-finite columns skipped** → no fake stats; deps `[headerStats, leafColumns, bodyData]`
- **渲染**: flat header `:8670-8683` + grouped leaf header `:8431-8444`（`isLeaf` 守卫，组表头永不显示）; text `n=N · avg=X.XX` (`toFixed(2)`), `aria-label`, `data-iris-header-stats=""`
- **muted 小字**: token-driven inline style (`--iris-muted`, `--iris-font-size-xs`=12px, `--iris-space-xxs`=4px) — uispacing/uicolor/uifont clean
- **与列汇总条区分矩阵**: headerStats = header-cell inline count+avg vs `columnTotals`/summary-row = footer strip SUM; independent opt-ins
- **fail-closed**: default off → zero extra DOM nodes; pure render-time, SSR-safe

**File map**: `advanced.ts` + `Table.tsx` (5 touch points) + `test/batch-dl-dt.test.tsx` + read-only helpers (`useTableColumns.ts:226-233`, `table-constants.ts:57`); manifest current (2 entries + llms.txt); zero core/vue/solid/svelte/styles/i18n changes.

**Test plan**: spec-mandated 表头统计 test delivered (`batch-dl-dt.test.tsx:88-96` — text col null / `amount` → `n=3 · avg=2.57`), 10/10 suite; 10 contract checks verified by anchors (non-finite exclusion, empty columns, two decimals, grouped `isLeaf` guard, current-body source, ARIA, token styling, totals-strip isolation). One non-blocking observation: grouped-path rendering lacks a dedicated regression case (flat-only covered); suite + gate (180/180 Turbo, React 2815/2815) all green.
