import { createDataSource } from './data-source'
import { derived, type Store } from './store'
import type { SortState } from './data-view'

/**
 * Framework-agnostic server-side table source (vxe-grid proxyConfig parity,
 * query slice). Owns paging / remote sort / remote filter state and the
 * fetch lifecycle (`loading → data | error`) with latest-wins race protection,
 * so the table adapters get a uniform contract for server-driven pages.
 *
 * Implementation note: this is a thin projection over the unified data engine
 * (`createDataSource`) — the same engine the resource controller and pro-table
 * consume — so paging, epoch-token latest-wins, abort and destroy semantics
 * are shared, not re-implemented. Only the naming (`data`/`params`) and the
 * `Error`-typed error are mapped.
 */

/** Query params handed to {@link RemoteTableSourceOptions.query}. */
export interface RemoteTableParams {
  /** 1-based page number. */
  page: number
  pageSize: number
  /** Active sort, or null. Passed through when remote sort is enabled. */
  sort: SortState | null
  /** key → filter value (empty string = inactive). */
  filters: Record<string, string>
}

/** Live state of a {@link RemoteTableSource}. */
export interface RemoteTableSourceState<Row> {
  /** Rows of the current page. */
  data: Row[]
  /** Total row count across all pages. */
  total: number
  loading: boolean
  error: Error | null
  params: RemoteTableParams
}

export interface RemoteTableSourceOptions<Row> {
  /** Fetch one page for the given params. */
  query: (params: RemoteTableParams) => Promise<{ rows: Row[]; total: number }>
  /** Auto-load the first page on creation. Default true. */
  autoLoad?: boolean
  /** Initial params (page / pageSize / sort / filters). Defaults: page 1, pageSize 10, sort null, filters {}. */
  initialParams?: Partial<RemoteTableParams>
}

export interface RemoteTableSource<Row> {
  getState(): RemoteTableSourceState<Row>
  subscribe(listener: (state: RemoteTableSourceState<Row>) => void): () => void
  /**
   * Fetch the current params. With a partial params argument, applies them
   * first (sort/filter changes reset the page to 1, vxe behavior).
   * Concurrent calls are token-guarded: only the most recent applies.
   */
  request(params?: Partial<RemoteTableParams>): Promise<void>
  /** Re-fetch the current page (retry / refresh). */
  refetch(): Promise<void>
  /**
   * Merge partial params and re-request. A sort/filter change resets the page
   * to 1 (vxe proxyConfig behavior). No-op (no request) when nothing changed.
   */
  setParams(partial: Partial<RemoteTableParams>): void
  /**
   * Tear down: abort any in-flight request so a late response never writes
   * back to a torn-down (e.g. unmounted) instance. Idempotent; safe to
   * `request()` again afterwards.
   */
  destroy(): void
}

function toError(value: unknown): Error | null {
  if (value == null) return null
  return value instanceof Error ? value : new Error(String(value))
}

function sortEqual(a: SortState | null, b: SortState | null): boolean {
  return (a?.key ?? null) === (b?.key ?? null) && (a?.direction ?? null) === (b?.direction ?? null)
}

function filtersEqual(a: Record<string, string>, b: Record<string, string>): boolean {
  if (Object.keys(a).length !== Object.keys(b).length) return false
  return Object.keys(a).every((key) => a[key] === b[key])
}

/**
 * Filters with an empty-string value are inactive (vxe contract). Strip them
 * in ONE normalization point so the query never sees a `''` entry and dedupe
 * treats `{ name: '' }` and `{}` as the same state.
 */
function normalizeFilters(filters: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {}
  for (const key of Object.keys(filters)) {
    const value = filters[key]
    if (value !== '') out[key] = value
  }
  return out
}

function paramsEqual(a: RemoteTableParams, b: RemoteTableParams): boolean {
  if (a.page !== b.page || a.pageSize !== b.pageSize) return false
  if (!sortEqual(a.sort, b.sort)) return false
  return filtersEqual(a.filters, b.filters)
}

export function createRemoteTableSource<Row>(
  options: RemoteTableSourceOptions<Row>,
): RemoteTableSource<Row> {
  // Per-field `??` (not spread): an explicitly-`undefined` initialParams field
  // falls back to the default instead of seeding `undefined` into the engine
  // (which would NaN paging / break `Object.keys(filters)`).
  const initial: RemoteTableParams = {
    page: options.initialParams?.page ?? 1,
    pageSize: options.initialParams?.pageSize ?? 10,
    sort: options.initialParams?.sort ?? null,
    filters: normalizeFilters(options.initialParams?.filters ?? {}),
  }

  // The unified data engine does the paging / token / latest-wins work; this
  // controller is a projection onto the remote-table contract. `immediate:
  // false` so no request fires during construction — `autoLoad` is honored
  // explicitly below (the React bridge kicks the load from an effect instead).
  const ds = createDataSource<Row>({
    fetcher: ({ page, pageSize, sort, filters }) =>
      options.query({ page, pageSize, sort, filters }),
    pageSize: initial.pageSize,
    immediate: false,
  })
  // Seed the initial params without triggering a request (autoLoad: false
  // must not query on creation).
  ds.store.setState((s) => ({
    ...s,
    page: initial.page,
    sort: initial.sort,
    filters: initial.filters,
  }))

  const store: Store<RemoteTableSourceState<Row>> = derived([ds.store], (s) => ({
    data: s.rows,
    total: s.total,
    loading: s.loading,
    error: toError(s.error),
    params: { page: s.page, pageSize: s.pageSize, sort: s.sort, filters: s.filters },
  }))

  const applyParams = (partial: Partial<RemoteTableParams>): boolean => {
    const s = ds.store.getState()
    const merged: RemoteTableParams = {
      page: partial.page ?? s.page,
      pageSize: partial.pageSize ?? s.pageSize,
      sort: partial.sort !== undefined ? partial.sort : s.sort,
      filters: partial.filters !== undefined ? normalizeFilters(partial.filters) : s.filters,
    }
    // vxe behavior: a sort/filter VALUE change resets the page to 1. Compare
    // by value (not key presence) so a controlled `sort`/`filters` prop with
    // fresh object identity each render never spuriously resets an active
    // page or re-queries (e.g. an inline `sort={{ key, direction }}` literal).
    const sortChanged = partial.sort !== undefined && !sortEqual(s.sort, partial.sort)
    const filtersChanged = partial.filters !== undefined && !filtersEqual(s.filters, merged.filters)
    if (sortChanged || filtersChanged) merged.page = 1
    const current: RemoteTableParams = {
      page: s.page,
      pageSize: s.pageSize,
      sort: s.sort,
      filters: s.filters,
    }
    if (paramsEqual(current, merged)) return false
    ds.store.setState({ ...s, ...merged })
    return true
  }

  /**
   * Load the current page, then recover when the server reports a total that
   * no longer covers the current page (rows deleted server-side): jump back
   * to the last valid page so the pager and the query never diverge (the
   * stale page would otherwise show zero rows and stay unrecoverable).
   */
  async function loadClamped(): Promise<void> {
    await ds.load()
    const s = ds.store.getState()
    const maxPage = Math.max(1, Math.ceil(s.total / s.pageSize))
    if (s.total > 0 && s.error == null && !s.loading && s.page > maxPage) {
      ds.store.setState((st) => ({ ...st, page: maxPage }))
      await ds.load()
    }
  }

  const controller: RemoteTableSource<Row> = {
    getState: store.getState,
    subscribe: store.subscribe,
    async request(partial) {
      if (partial) {
        if (!applyParams(partial)) return
      }
      return loadClamped()
    },
    refetch: () => loadClamped(),
    setParams(partial) {
      if (!applyParams(partial)) return
      void loadClamped()
    },
    destroy: () => ds.destroy(),
  }

  // autoLoad parity: fire the first request on creation unless disabled (the
  // React bridge passes false and kicks the load from an effect instead).
  if (options.autoLoad !== false) void controller.request()

  return controller
}
