# Baseline: vxe-grid `proxyConfig` server-side data source parity (Batch C)

> **Stage**: read-only documentation baseline. No source files were modified.
> **Scope**: parity for the **server-side data source** slice of vxe-grid's
> `proxyConfig` (query proxy: remote sort / filter / paging / seq, autoLoad,
> loading UI, response contract). Edit/insert/remove/save proxies are **out
> of scope** (iris-ui already has edit write-back; see §2.3).
> **Sources**: `/tmp/vxe-grid/package/types/components/grid.d.ts` (vxe-table@4.20.10),
> `packages/react/src/primitives/table/props.ts`, `packages/core/src/index.ts`,
> `docs/vxe-grid-comparison.md`, plus `packages/core/src/resource.ts`,
> `pagination.ts`, `data-source.ts` and `packages/react/src/resource/useResourceController.ts`
> read for overlap analysis.

---

## 1. vxe-grid `proxyConfig` official semantics

### 1.1 Config flags (from `interface ProxyConfig<D>`, grid.d.ts ~L144)

| Field                             | Type                                                           | Semantics                                                                                                     |
| --------------------------------- | -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `enabled`                         | `boolean`                                                      | Master switch for the whole proxy.                                                                            |
| `autoLoad`                        | `boolean`                                                      | Auto-load query data on mount (no manual `query()` call needed).                                              |
| `showLoading`                     | `boolean`                                                      | Automatically show the built-in loading UI during requests.                                                   |
| `message` / `showResponseMsg`     | `boolean`                                                      | Built-in message toasts; `message` is `@deprecated`, use `showResponseMsg`.                                   |
| `showActiveMsg` / `showActionMsg` | `boolean`                                                      | Toasts for CRUD actions (`showActiveMsg` deprecated). Out of scope here.                                      |
| `seq`                             | `boolean`                                                      | Proxy dynamic sequence: cumulative sequence number computed from paging (`(currentPage-1)*pageSize + index`). |
| `sort`                            | `boolean`                                                      | Proxy sorting: sort state is **not** applied client-side; it is handed to the server via the query.           |
| `filter`                          | `boolean`                                                      | Proxy filtering: filter state handed to the server, not applied client-side.                                  |
| `form` / `footer`                 | `boolean`                                                      | Proxy search-form / footer data. Out of scope for batch C.                                                    |
| `response`                        | `ProxyConfigResponseConfig<D>`                                 | Response extraction config (see 1.3).                                                                         |
| `ajax`                            | `{ beforeQuery, query, afterQuery, querySuccess, queryError }` | Async request pipeline (see 1.2).                                                                             |

### 1.2 Request pipeline & query params (`ajax.*`)

Execution order (documented in grid.d.ts): **`beforeQuery` → `query` → `afterQuery` → `querySuccess | queryError`**.

- `beforeQuery(params): boolean | Promise<boolean>` — veto hook; `false` aborts the request.
- `query(params): Promise<any>` — the actual data load.
- `afterQuery(params & { response, status: 'success' | 'error' })` — rewrite/default-override hook.
- `querySuccess(params & { response })` / `queryError(params & { response })` — terminal hooks.

The `query` receives `ProxyAjaxQueryParams<D>`:

```ts
interface ProxyAjaxQueryParams<D> {
  $table: VxeTableConstructor<D>; $grid: VxeGridConstructor<D> | null; $gantt: ... // instance refs (iris: N/A)
  page: {
    total: number        // current page's total (as last known)
    pageSize: number
    currentPage: number  // 1-based
  }
  sort:  ProxyAjaxQuerySortCheckedParams<D>   // primary sort
  sorts: ProxyAjaxQuerySortCheckedParams<D>[] // multi-sort list
  filters: FilterCheckedParams[]              // key → checked values
  form: { [key: string]: any }                // search-form state
}
interface ProxyAjaxQuerySortCheckedParams<D> {
  column: ColumnInfo<D>; order: string; sortBy: string; field: string; property: string
}
```

So the server contract is: **1-based `currentPage` + `pageSize` + `sort`/`sorts`
(field + order) + `filters`**. The page object also carries the previously-known
`total` (used by the built-in pager before the response arrives).

### 1.3 Response contract (`ProxyConfigResponseConfig<D>`, grid.d.ts ~L777)

Each field is either a **dotted path string** into the raw response, or a
**function** receiving `{ data, $table, $grid, $gantt }`:

```ts
interface ProxyConfigResponseConfig<D> {
  list?: string | ((p) => any[]) // row array
  result?: string | ((p) => any[]) // legacy alias of list
  total?: string | ((p) => number) // total row count
  footerData?: string | ((p) => any[])
  message?: string | ((p) => string)
}
```

Typical usage: `response: { list: 'data.records', total: 'data.total' }`.
Failures surface through `queryError`/`showResponseMsg`, not through thrown
exceptions in the caller.

### 1.4 Remote behavior semantics (what `sort/filter/seq: true` actually do)

| Flag                | Client-side effect                                                                                          | Server-side effect                                            |
| ------------------- | ----------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| `sort: true`        | Sort arrows still render; **no** client re-ordering                                                         | `sort`/`sorts` (field/order) included in the query → re-fetch |
| `filter: true`      | Filter UI still renders; **no** client row hiding                                                           | `filters` included in the query → re-fetch                    |
| paging              | Pager UI (via `pagerConfig`) drives `page.currentPage`/`pageSize`; changing page re-runs the query pipeline | paged response expected                                       |
| `seq: true`         | Sequence column becomes cumulative across pages: `(currentPage - 1) * pageSize + rowIndex + 1`              | none (computed client-side from paging state)                 |
| `autoLoad: true`    | First query fires on mount; `autoLoad: false` requires a manual `query()` (e.g. from a search button)       | —                                                             |
| `showLoading: true` | Built-in loading overlay during in-flight query                                                             | —                                                             |

---

## 2. iris-ui current coverage (evidence)

### 2.1 React `IrisTableProps` (packages/react/src/primitives/table/props.ts)

| vxe proxy capability                | iris-ui today                                                                                                                        | Evidence                             |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------ |
| Loading UI                          | ✅ `loading`, `loadingState`, `error`/`errorState`, `onRetry` (built-in retry button)                                                | props.ts                             |
| Sort (client-side)                  | ✅ `sort`/`defaultSort`/`onSortChange` (`IrisTableSortState`, single-column)                                                         | props.ts                             |
| Filters (client-side)               | ✅ `filters`/`onFiltersChange` (column key → text, core `filterSort` substring)                                                      | props.ts                             |
| Sequence column                     | ✅ `seq` + `seqStartIndex` + `seqMethod`                                                                                             | props.ts                             |
| Edit write-back                     | ✅ `editConfig` + `onCellEdit` (commit event)                                                                                        | props.ts                             |
| Pager                               | ⚠️ Standalone `IrisPagination` primitive (`total`, `pageSize`, `value`, `onValueChange`) exists — **not wired into IrisTable props** | primitives/pagination/Pagination.tsx |
| Remote sort / filter / paging flags | ❌ no `remoteSort`/`remoteFilter`/pager props                                                                                        | props.ts                             |
| `proxyConfig`-style query prop      | ❌ absent                                                                                                                            | props.ts                             |

### 2.2 Core primitives (packages/core/src/index.ts)

All framework-agnostic, zero framework imports:

- **`createResourceController`** (resource.ts) — **already implements nearly the
  exact proposed `createRemoteTableSource` contract**: `fetcher(query: ResourceQuery
{ page, pageSize, sort, filters }) → Promise<{ rows, total }>`, state
  `{ rows, total, page, pageSize, sort, filters, loading, error, selectedKeys }`,
  methods `load`/`reload`/`setPage`/`setPageSize`/`setSort`/`setFilter`/`clearFilters`/
  `pageCount`/`mutate`/`destroy`, optional `resilient` wrapping (cache/circuit-breaker/
  rate-limiter), `immediate` autoLoad flag.
- `createDataSource` (data-source.ts) — L4 composite (paged/infinite + selection +
  outbox + resilient), `rows/total/loading/error` state.
- `createPaginatedResource` (pagination.ts) — `items`/`total`, `goToPage`/`loadMore`/
  `refresh`/`setPageSize`, token-guarded against out-of-order responses.
- `createAsyncResource`, `resilient-fetcher` (dedup/TTL/SWR + breaker + limiter).
- React bridge **`useResourceController`** already exists
  (packages/react/src/resource/useResourceController.ts): construct-once,
  `immediate:false` + effect-kick, store subscription → live `state`, destroy on unmount.

### 2.3 Gap summary

The **controller half is already built** (`createResourceController` + React bridge).
What is missing is the **table-side adapter**:

1. No `proxyConfig` prop on `IrisTableProps` (query wiring, remote flags, autoLoad).
2. No pager rendering/integration inside the table (pagination is a separate primitive).
3. Remote sort/filter events aren't routed to a controller (`onSortChange` is local-only).
4. No cumulative seq across pages (`seqStartIndex` only).
5. No response-shape mapping (iris can standardize on the typed contract instead).

---

## 3. The gap: proposed `proxyConfig` prop shape (TS-first)

> Decision: iris-ui standardizes on a **typed Promise contract** (`query` returns
> `{ rows, total }`) rather than vxe's string-path response extraction. Path-based
> extraction (`response.list/total`) can be a later additive nicety; it is **not**
> needed for batch C parity and would add unchecked string magic.

### 3.1 `IrisTableProxyConfig<Row>` (proposed, TS-first)

```ts
/** Server-side data proxy (vxe-grid proxyConfig parity, query slice). */
export interface IrisTableProxyConfig<Row extends Record<string, unknown>> {
  /**
   * Fetch one page. 1-based `page`; `pageSize` from `pageSize` (default 10).
   * `sort`/`filters` are the ACTIVE sort/filter state — passed through when
   * `remoteSort`/`remoteFilter` are enabled.
   */
  query: (params: {
    page: number
    pageSize: number
    sort: IrisTableSortState | null
    filters: Record<string, string>
  }) => Promise<{ rows: Row[]; total: number }>
  /** Auto-load the first page on mount (vxe autoLoad parity). Default true. */
  autoLoad?: boolean
  /** Show the table loading UI during in-flight queries (vxe showLoading parity). Default true. */
  showLoading?: boolean
  /** Sort changes are re-queried, not applied client-side (vxe proxyConfig.sort). Default false. */
  remoteSort?: boolean
  /** Filter changes are re-queried, not applied client-side (vxe proxyConfig.filter). Default false. */
  remoteFilter?: boolean
  /** Cumulative sequence across pages (vxe proxyConfig.seq). Default false. */
  seq?: boolean
  /** Controlled current page (1-based). Default 1. */
  page?: number
  /** Rows per page. Default 10. */
  pageSize?: number
  /** Fired when the page or page size changes (parent owns the values). */
  onPageChange?: (next: { page: number; pageSize: number }) => void
}
```

### 3.2 Prop wiring on `IrisTableProps` (proposed)

```ts
/** vxe-grid proxyConfig parity. When set, `data` becomes the loaded page. */
proxyConfig?: IrisTableProxyConfig<Row>
```

- When `proxyConfig` is set, `data` is **ignored** (or used as the initial
  uncontrolled seed — open question, §5); rows come from `query`.
- `onSortChange` / `onFiltersChange` fire as today; when `remoteSort` /
  `remoteFilter` are true the new state is fed back into `query` (via the core
  controller's `setSort`/`setFilter`, which reload from page 1 — matching vxe).
- The table renders `IrisPagination` below the body when `proxyConfig` is set
  (vxe `pagerConfig.enabled` parity), driven by `page`/`pageSize`/`total` and
  emitting `onPageChange`.
- `loading`/`error`/`onRetry` remain the single source of truth for UI state;
  `proxyConfig.showLoading` only toggles whether loading is auto-driven.

---

## 4. Core controller: `createRemoteTableSource`

### 4.1 Proposed interface (framework-agnostic, zero framework imports)

```ts
export interface RemoteTableSource<T> {
  getState(): {
    data: T[]
    total: number
    page: number
    pageSize: number
    sort: SortState | null
    filters: Record<string, string>
    loading: boolean
    error: unknown
  }
  subscribe(listener: (state: RemoteTableSourceState<T>) => void): () => void
  /** Imperative load of the current page (alias-friendly; vxe query() parity). */
  request(): Promise<void>
  /** Reload the current page (retry / refresh parity). */
  refetch(): Promise<void>
  setPage(page: number): void // reload from page 1 semantics on page change
  setPageSize(size: number): void
  setSort(sort: SortState | null): void // reload from page 1 when remoteSort
  setFilter(key: string, value: string): void
  clearFilters(): void
  destroy(): void
}
```

### 4.2 ⚠️ Overlap finding — `createResourceController` already exists

`packages/core/src/resource.ts` implements **this exact interface today**, with
small naming deltas:

| Proposed `createRemoteTableSource`                           | Existing `createResourceController`                          |
| ------------------------------------------------------------ | ------------------------------------------------------------ |
| state `data`                                                 | state `rows`                                                 |
| `request()`                                                  | `load()` (alias `reload()` exists)                           |
| `refetch()`                                                  | `reload()`                                                   |
| `setPage`/`setPageSize`/`setSort`/`setFilter`/`clearFilters` | ✅ identical                                                 |
| `subscribe`/`getState`/`store`                               | ✅ identical (+ `store`, `selection`, `mutate`, `pageCount`) |
| `autoLoad`                                                   | ✅ `immediate`                                               |
| —                                                            | ✅ `resilient` wrapping, `destroy`                           |

**Recommendation (costed alternatives)**:

- **Option A — thin alias module (recommended)**: add
  `packages/core/src/remote-table-source.ts` that re-exports `createResourceController`
  with a `RemoteTableSource`-shaped public type (`data`/`request`/`refetch` naming)
  and a tiny mapping layer (`rows → data`, `load → request`, `reload → refetch`).
  ~40 lines, zero logic duplication, keeps the batch-C contract name in the docs
  while the implementation stays in the battle-tested controller.
- **Option B — direct consumption**: the react adapter consumes
  `createResourceController` + `useResourceController` as-is (no new core file);
  the "proposed interface" above is documented as the contract, satisfied by
  existing names. Cheapest; naming mismatch (`rows` vs `data`) stays visible.
- **Option C — new standalone controller**: duplicate the logic. **Rejected** —
  violates the repo's "logic sinks to core, no duplication" decision.

Either way: **framework-agnostic ✅, zero framework imports ✅** (core has no react
imports; the bridge lives in `packages/react/src/resource/useResourceController.ts`).

---

## 5. File map for the adapt stage

| #   | File (repo-relative)                                       | Change                                                                                                                                                                                                                                                                                       |
| --- | ---------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `packages/core/src/remote-table-source.ts`                 | **NEW** (Option A): `createRemoteTableSource` + types, thin typed layer over `createResourceController` (`data`/`request`/`refetch` naming). Option B: skip this file.                                                                                                                       |
| 2   | `packages/core/src/index.ts`                               | Barrel export: `createRemoteTableSource`, `RemoteTableSource`, `RemoteTableSourceState` (+ types).                                                                                                                                                                                           |
| 3   | `packages/core/src/remote-table-source.test.ts`            | **NEW**: contract tests — query params (1-based page/pageSize/sort/filters), `{rows,total}` resolution, `request`/`refetch` reload semantics, setPage/setSort/setFilter reload-from-page-1, loading/error state transitions, out-of-order token guard, destroy.                              |
| 4   | `packages/react/src/primitives/table/types.ts`             | **NEW types**: `IrisTableProxyConfig<Row>` (+ `IrisTableQueryParams`).                                                                                                                                                                                                                       |
| 5   | `packages/react/src/primitives/table/props.ts`             | Add `proxyConfig?: IrisTableProxyConfig<Row>` to `IrisTableProps` (additive, default off).                                                                                                                                                                                                   |
| 6   | `packages/react/src/primitives/table/useRemoteTable.ts`    | **NEW hook** (or extend `useTableState.ts`): bridges `IrisTableProxyConfig` → `useResourceController`; maps controller state to table props (`data`, `loading`, `error`, `onRetry → refetch`); derives `seq` offset `(page-1)*pageSize`; owns `onPageChange`.                                |
| 7   | `packages/react/src/primitives/table/Table.tsx`            | Wire the hook: honor `proxyConfig` (data source overrides `data`), render `IrisPagination` below the body, route sort/filter changes back to the controller when `remoteSort`/`remoteFilter`.                                                                                                |
| 8   | `packages/react/src/primitives/table/proxyConfig.test.tsx` | **NEW**: integration tests — autoLoad on mount, page change re-query with `{page,pageSize}`, remoteSort/remoteFilter re-query params, seq cumulative across pages, loading/error/retry states, pager rendering, `remoteFilter`+local-filter interplay, unmount cancels in-flight write-back. |
| 9   | `packages/react/src/primitives/table/index.ts`             | Export new types (check current re-export surface).                                                                                                                                                                                                                                          |
| 10  | `docs/vxe-grid-comparison.md`                              | Update parity matrix: 数据代理 row → `proxyConfig` (query slice) ✅ batch C; add build-status row 批 6.                                                                                                                                                                                      |
| 11  | `docs/vxe-grid/proxyconfig-baseline.md`                    | This baseline (keep as the batch-C design reference).                                                                                                                                                                                                                                        |

**Non-goals for batch C**: insert/remove/save proxies, `form`/`footer` proxy,
response path-string extraction, multi-sort UI, `showResponseMsg` toasts.

**Open questions** (to confirm at design stage, not blocking this baseline):

1. `proxyConfig` + explicit `data`: error, ignore `data`, or seed?
2. Pager placement/size parity: `IrisPagination` props mapping (page-size menu?).
3. Keep `createResourceController.selection`/`mutate` visible through the
   `RemoteTableSource` alias, or trim the surface?
4. Does `onPageChange` also fire on page-size change, or a separate `onPageSizeChange`?
5. Seq offset parity when `pageSize` changes mid-session (reset to page 1 — vxe behavior).
