/**
 * Type definitions for the unified data engine.
 */

import type { Store } from '../store'
import type { SelectionModel } from '../selection'
import type { SortState, FilterRule } from '../data-view'
import type { ResilientFetcherOptions } from '../resilient-fetcher'
import type { Outbox, OutboxStorage } from '../outbox'

export interface DataSourceQuery {
  page: number
  pageSize: number
  sort: SortState | null
  multiSort: SortState[]
  filters: Record<string, string>
  filterRules: FilterRule[]
}

export type DataSourceMode = 'paged' | 'infinite'

export interface DataSourceConfig<T> {
  fetcher: (
    query: DataSourceQuery,
    signal?: AbortSignal,
  ) => { rows: T[]; total: number } | Promise<{ rows: T[]; total: number }>
  pageSize?: number
  mode?: DataSourceMode
  immediate?: boolean
  /** Max rows to accumulate in infinite mode. Default: 5000. When exceeded,
   * `loadMore` becomes a no-op. Prevents unbounded DOM/state growth. */
  maxRows?: number
  /**
   * Enable resilient fetching: cache (dedup/TTL/SWR), circuit breaker, and
   * optional rate limiting. When enabled, the data source wraps its internal
   * fetcher with `createResilientFetcher`, so repeated queries for the same
   * page/sort/filters hit cache instead of the network, and transient failures
   * are isolated by the circuit breaker.
   */
  resilient?: ResilientFetcherOptions
  /**
   * Enable offline mutation outbox: when set, every `mutate` / `mutateRow` call
   * is enqueued in a durable FIFO queue instead of running immediately. The
   * queue is flushed in order when connectivity returns. Pass `true` for default
   * in-memory storage, or an {@link OutboxStorage} for persistent storage.
   *
   * The outbox guarantees at-least-once, in-order delivery — a mutation that
   * fails (offline, flaky network) stays queued and is retried until it succeeds
   * or exceeds `maxAttempts`. Failed items are skipped so the queue doesn't
   * block.
   */
  outbox?: boolean | { storage?: OutboxStorage<unknown>; maxAttempts?: number }
}

export interface DataSourceState<T> {
  rows: T[]
  total: number
  page: number
  pageSize: number
  sort: SortState | null
  multiSort: SortState[]
  filters: Record<string, string>
  filterRules: FilterRule[]
  loading: boolean
  loadingMore: boolean
  error: unknown
  hasMore: boolean
  selectedKeys: string[]
  pendingRows: string[]
  rowErrors: Record<string, unknown>
}

export interface MutateOptions<T> {
  optimistic?: (rows: T[]) => T[]
  skipReload?: boolean
}

export interface RowMutateOptions<T> {
  optimistic?: (rows: T[]) => T[]
  skipReload?: boolean
}

export interface DataSourceController<T> {
  store: Store<DataSourceState<T>>
  selection: SelectionModel
  getState(): DataSourceState<T>
  subscribe(listener: (state: DataSourceState<T>) => void): () => void
  load(): Promise<void>
  reload(): Promise<void>
  loadMore(): Promise<void>
  setPage(page: number): void
  setPageSize(size: number): void
  setSort(sort: SortState | null): void
  setMultiSort(multiSort: SortState[]): void
  setFilter(key: string, value: string): void
  setFilterRules(rules: FilterRule[]): void
  clearFilters(): void
  pageCount(): number
  hasMore(): boolean
  isRowPending(rowKey: string): boolean
  rowError(rowKey: string): unknown
  mutate(action: () => Promise<unknown>, options?: MutateOptions<T>): Promise<void>
  mutateRow(
    rowKey: string,
    action: () => Promise<unknown>,
    options?: RowMutateOptions<T>,
  ): Promise<void>
  /** The mutation outbox (offline queue), if enabled. Flush on reconnect. */
  readonly outbox?: Outbox<unknown>
  destroy(): void
}
