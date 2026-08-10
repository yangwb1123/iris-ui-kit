Baseline complete. Written to `/home/u1/iris-ui/docs/vxe-grid/batch-c-baseline.md` (16.5 KB, the only change; the `.vinxi` modifications in git status are pre-existing build artifacts).

## Summary of findings

**vxe-grid `proxyConfig` semantics** (grid.d.ts): `query` receives `{ page: { total, pageSize, currentPage (1-based) }, sort/sorts (field+order), filters, form }` via the `beforeQuery → query → afterQuery → querySuccess|queryError` pipeline; response extraction is dotted-path-or-function (`response.list/total`); `sort`/`filter: true` hand state to the server (no client re-order/hide), `seq` computes cumulative `(page-1)*pageSize + index`, `autoLoad` fires on mount, `showLoading` drives the built-in loading UI.

**iris-ui coverage**: loading/error/`loadingState`/`errorState`/`onRetry` ✅, client-side `sort` + `filters` ✅, `seq`/`seqStartIndex` ✅, edit write-back via `editConfig`+`onCellEdit` ✅. `IrisPagination` exists but is **not wired into IrisTable**; no remote flags, no query prop.

**Key overlap finding**: `createResourceController` (core/resource.ts) + its React bridge `useResourceController` already implement ~90% of the proposed `createRemoteTableSource` contract — `fetcher({page,pageSize,sort,filters}) → {rows,total}`, `loading/error` state, `load/reload/setPage/setSort/setFilter`, `immediate` (autoLoad), `resilient` wrapping, `destroy`. Only naming deltas (`rows`↔`data`, `load`↔`request`).

**Recommendation**: Option A — a ~40-line thin alias module `remote-table-source.ts` exposing the batch-C names over the existing controller (Option C duplication rejected per the repo's "logic sinks to core" rule). The baseline captures the proposed `IrisTableProxyConfig` shape (typed `query → Promise<{rows,total}>`, `remoteSort`/`remoteFilter`/`seq` flags, `page`/`pageSize`/`onPageChange`, `autoLoad`), the `RemoteTableSource` interface, an 11-file adapt-stage map (core module + barrel + contract test; react types/props/`useRemoteTable.ts`/`Table.tsx` + integration test; matrix update), and 5 open questions. No source files were touched.
