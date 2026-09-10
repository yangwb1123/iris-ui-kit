/**
 * Type definitions for the unified data engine.
 */

import type { Store } from '../store'
import type { SelectionModel } from '../selection'
import type { SortState, FilterRule } from '../data-view'
import type { ResilientFetcherOptions } from '../resilient-fetcher'
import type { AdvancedOutbox, Outbox, OutboxMutationDescriptor, OutboxStorage } from '../outbox'

export interface DataSourceQuery {
  page: number
  pageSize: number
  sort: SortState | null
  multiSort: SortState[]
  filters: Record<string, string>
  filterRules: FilterRule[]
}

export type DataSourceMode = 'paged' | 'infinite'

/** A JSON-safe descriptor used to reconstruct a mutation in another process. */
export type DataSourceMutationDescriptor = OutboxMutationDescriptor

export interface DataSourceOutboxOptions {
  /**
   * Durable storage. When supplied, every mutation must provide a
   * JSON-serializable `MutateOptions.descriptor`; action closures are rejected.
   */
  storage?: OutboxStorage<unknown>
  maxAttempts?: number
  /** Execute a descriptor loaded by a fresh data-source instance. */
  executor?: (descriptor: DataSourceMutationDescriptor) => Promise<unknown>
}

export type DataSourceMutationStatus = 'delivered' | 'deferred' | 'failed'

/** Item-aware result exposed by the additive `mutateResult` APIs. */
export interface DataSourceMutationOutcome {
  status: DataSourceMutationStatus
  id?: string
  /** Original action error when this process has one, or a stable boundary error. */
  error?: unknown
  attempts?: number
  /** Whether the mutation remains queued after this delivery attempt. */
  queued: boolean
}

/** Stable error used when an outbox item remains queued for retry. */
export class DataSourceMutationDeferredError extends Error {
  readonly code = 'DATA_SOURCE_MUTATION_DEFERRED'
  override readonly cause?: unknown

  constructor(cause?: unknown) {
    const detail = cause instanceof Error ? `: ${cause.message}` : ''
    super(`Data-source mutation deferred${detail}`)
    this.name = 'DataSourceMutationDeferredError'
    this.cause = cause
  }
}

/** Stable error used when a queued mutation cannot be confirmed as delivered. */
export class DataSourceMutationUndeliveredError extends Error {
  readonly code = 'DATA_SOURCE_MUTATION_UNDELIVERED'

  constructor(message = 'Data-source mutation was not delivered') {
    super(message)
    this.name = 'DataSourceMutationUndeliveredError'
  }
}

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
   * is enqueued instead of running immediately. Pass `true` (or an object
   * without `storage`) for the legacy in-memory closure path. An object with
   * `storage` is durable: callers must also pass a JSON-safe `descriptor` in
   * mutation options, and a fresh instance needs `executor` to replay it.
   *
   * The outbox guarantees at-least-once, in-order delivery. A failed mutation
   * is either `deferred` (still pending and retryable) or `failed` (exhausted
   * `maxAttempts`); neither state is treated as success by the data source.
   */
  outbox?: boolean | DataSourceOutboxOptions
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
  /**
   * JSON-safe descriptor for durable outbox storage. It is ignored by the
   * in-memory closure path, where `action` remains the executor.
   */
  descriptor?: DataSourceMutationDescriptor
}

export interface RowMutateOptions<T> {
  optimistic?: (rows: T[]) => T[]
  skipReload?: boolean
  /** JSON-safe descriptor for durable outbox storage; see {@link MutateOptions.descriptor}. */
  descriptor?: DataSourceMutationDescriptor
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
  /** Run a mutation using the legacy void contract. */
  mutate(action: () => Promise<unknown>, options?: MutateOptions<T>): Promise<void>
  /** Same legacy contract as `mutate`, scoped to one row key. */
  mutateRow(
    rowKey: string,
    action: () => Promise<unknown>,
    options?: RowMutateOptions<T>,
  ): Promise<void>
  /** The mutation outbox (offline queue), if enabled. Flush on reconnect. */
  readonly outbox?: Outbox<unknown>
  destroy(): void
}

/**
 * Factory return surface. The legacy controller remains implementable by
 * existing consumers; new mutation-result APIs are guaranteed on factories
 * created by this package.
 */
export interface AdvancedDataSourceController<T> extends DataSourceController<T> {
  mutateResult(
    action: () => Promise<unknown>,
    options?: MutateOptions<T>,
  ): Promise<DataSourceMutationOutcome>
  mutateRowResult(
    rowKey: string,
    action: () => Promise<unknown>,
    options?: RowMutateOptions<T>,
  ): Promise<DataSourceMutationOutcome>
  readonly outbox?: AdvancedOutbox<unknown>
}
