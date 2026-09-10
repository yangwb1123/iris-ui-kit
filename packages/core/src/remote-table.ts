import { createDataSource } from './data-source'
import type { ResilientFetcherOptions } from './resilient-fetcher'
import { derived, type Store } from './store'
import type { DataSourceController } from './data-source/types'
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
  /**
   * Multi-column sort (vxe sort-config.multiple parity), most-significant
   * first. Optional — only multiSort-mode tables set it; the single `sort`
   * field stays the single-column channel (the two are mutually exclusive).
   */
  sorts?: SortState[]
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
  /** Fetch one page for the given params, optionally observing cancellation. */
  query: (
    params: RemoteTableParams,
    signal?: AbortSignal,
  ) => Promise<{ rows: Row[]; total: number }>
  /** Auto-load the first page on creation. Default true. */
  autoLoad?: boolean
  /** Initial params (page / pageSize / sort / filters). Defaults: page 1, pageSize 10, sort null, filters {}. */
  initialParams?: Partial<RemoteTableParams>
  /** Optional Core resilient fetching (dedup/TTL/SWR, breaker, and rate limiting). */
  resilient?: ResilientFetcherOptions
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
   * to 1 (vxe proxyConfig behavior). Returns false when nothing changed (no
   * request fired) — callers that must re-query regardless (e.g. form reset)
   * can fall back to `refetch()`.
   */
  setParams(partial: Partial<RemoteTableParams>): boolean
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

function cloneSort<T extends SortState | null | undefined>(sort: T): T {
  return (sort == null ? sort : { ...sort }) as T
}

function cloneSorts(sorts: SortState[] | undefined): SortState[] | undefined {
  return sorts?.map((sort) => ({ ...sort }))
}

function cloneFilters(filters: Record<string, string>): Record<string, string> {
  return { ...filters }
}

/** Order-sensitive multi-sort equality; `undefined` and `[]` are equivalent. */
function sortsEqual(a: SortState[] | undefined, b: SortState[] | undefined): boolean {
  const la = a?.length ?? 0
  const lb = b?.length ?? 0
  if (la !== lb) return false
  for (let i = 0; i < la; i += 1) {
    if (!sortEqual(a?.[i] ?? null, b?.[i] ?? null)) return false
  }
  return true
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

function positiveInteger(value: number | undefined, fallback: number): number {
  return value !== undefined && Number.isFinite(value) && value > 0
    ? Math.max(1, Math.trunc(value))
    : fallback
}

function paramsEqual(a: RemoteTableParams, b: RemoteTableParams): boolean {
  if (a.page !== b.page || a.pageSize !== b.pageSize) return false
  if (!sortEqual(a.sort, b.sort)) return false
  if (!sortsEqual(a.sorts, b.sorts)) return false
  return filtersEqual(a.filters, b.filters)
}

function createInitialRemoteTableParams(
  initialParams: Partial<RemoteTableParams> | undefined,
): RemoteTableParams {
  // Per-field `??` (not spread): an explicitly-`undefined` field falls back
  // to the default instead of seeding invalid paging/filter state.
  return {
    page: positiveInteger(initialParams?.page, 1),
    pageSize: positiveInteger(initialParams?.pageSize, 10),
    sort: cloneSort(initialParams?.sort ?? null),
    sorts: cloneSorts(initialParams?.sorts),
    filters: normalizeFilters(initialParams?.filters ?? {}),
  }
}

function createRemoteTableDataSource<Row>(
  options: RemoteTableSourceOptions<Row>,
  initial: RemoteTableParams,
): DataSourceController<Row> {
  const ds = createDataSource<Row>({
    fetcher: ({ page, pageSize, sort, filters, multiSort }, signal) =>
      options.query(
        {
          page,
          pageSize,
          sort: cloneSort(sort),
          filters: cloneFilters(filters),
          // The `sorts` channel only exists in multi mode; single-mode queries
          // stay byte-identical.
          ...(multiSort.length > 0 ? { sorts: cloneSorts(multiSort) } : {}),
        },
        signal,
      ),
    pageSize: initial.pageSize,
    immediate: false,
    resilient: options.resilient,
  })
  ds.store.setState((state) => ({
    ...state,
    page: initial.page,
    sort: initial.sorts !== undefined ? null : cloneSort(initial.sort),
    multiSort: cloneSorts(initial.sorts) ?? state.multiSort,
    filters: cloneFilters(initial.filters),
  }))
  return ds
}

function createRemoteTableStore<Row>(
  ds: DataSourceController<Row>,
): Store<RemoteTableSourceState<Row>> {
  return derived([ds.store], (state) => ({
    data: state.rows,
    total: state.total,
    loading: state.loading,
    error: toError(state.error),
    params: {
      page: state.page,
      pageSize: state.pageSize,
      sort: cloneSort(state.sort),
      filters: cloneFilters(state.filters),
      ...(state.multiSort.length > 0 ? { sorts: cloneSorts(state.multiSort) } : {}),
    },
  }))
}

function createRemoteTableParamApplier<Row>(
  ds: DataSourceController<Row>,
): (partial: Partial<RemoteTableParams>) => boolean {
  return (partial) => {
    const state = ds.store.getState()
    const currentSorts: SortState[] | undefined =
      state.multiSort.length > 0 ? state.multiSort : undefined
    const sortProvided = partial.sort !== undefined
    const sortsProvided = partial.sorts !== undefined
    // `sort` and `sorts` are mutually exclusive channels. Supplying either
    // channel explicitly switches to it; omitted channels retain their state.
    const merged: RemoteTableParams = {
      page: positiveInteger(partial.page, state.page),
      pageSize: positiveInteger(partial.pageSize, state.pageSize),
      sort: sortsProvided ? null : sortProvided ? cloneSort(partial.sort)! : cloneSort(state.sort),
      sorts: sortsProvided
        ? cloneSorts(partial.sorts)
        : sortProvided
          ? undefined
          : cloneSorts(currentSorts),
      filters:
        partial.filters !== undefined
          ? normalizeFilters(partial.filters)
          : cloneFilters(state.filters),
    }
    // vxe behavior: value changes reset the page. Compare by value so fresh
    // controlled object identities do not spuriously reset or re-query.
    const sortChannelChanged =
      !sortEqual(state.sort, merged.sort) || !sortsEqual(currentSorts, merged.sorts)
    const sortChanged = (sortProvided || sortsProvided) && sortChannelChanged
    const filtersChanged =
      partial.filters !== undefined && !filtersEqual(state.filters, merged.filters)
    if (sortChanged || filtersChanged) merged.page = 1
    const current: RemoteTableParams = {
      page: state.page,
      pageSize: state.pageSize,
      sort: state.sort,
      sorts: currentSorts,
      filters: state.filters,
    }
    if (paramsEqual(current, merged)) return false
    ds.store.setState((next) => ({
      ...next,
      page: merged.page,
      pageSize: merged.pageSize,
      sort: merged.sorts !== undefined ? null : cloneSort(merged.sort),
      multiSort: sortsProvided
        ? (cloneSorts(merged.sorts) ?? [])
        : sortProvided
          ? []
          : next.multiSort,
      filters: cloneFilters(merged.filters),
    }))
    return true
  }
}

async function loadClamped<Row>(ds: DataSourceController<Row>): Promise<void> {
  await ds.load()
  const state = ds.store.getState()
  const maxPage = Math.max(1, Math.ceil(state.total / state.pageSize))
  if (state.error == null && !state.loading && state.page > maxPage) {
    ds.store.setState((next) => ({ ...next, page: maxPage }))
    await ds.load()
  }
}

function createRemoteTableController<Row>(
  ds: DataSourceController<Row>,
  store: Store<RemoteTableSourceState<Row>>,
  applyParams: (partial: Partial<RemoteTableParams>) => boolean,
): RemoteTableSource<Row> {
  const load = (): Promise<void> => loadClamped(ds)
  return {
    getState: store.getState,
    subscribe: store.subscribe,
    async request(partial) {
      if (partial && !applyParams(partial)) return
      return load()
    },
    refetch: load,
    setParams(partial) {
      if (!applyParams(partial)) return false
      void load()
      return true
    },
    destroy: () => ds.destroy(),
  }
}

export function createRemoteTableSource<Row>(
  options: RemoteTableSourceOptions<Row>,
): RemoteTableSource<Row> {
  const initial = createInitialRemoteTableParams(options.initialParams)
  const ds = createRemoteTableDataSource(options, initial)
  const store = createRemoteTableStore(ds)
  const controller = createRemoteTableController(ds, store, createRemoteTableParamApplier(ds))

  // autoLoad parity: fire the first request on creation unless disabled (the
  // React bridge passes false and kicks the load from an effect instead).
  if (options.autoLoad !== false) void controller.request()

  return controller
}
