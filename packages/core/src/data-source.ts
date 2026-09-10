/**
 * Framework-agnostic unified data engine (L4 composite).
 *
 * The convergence point for the list + pagination + selection + (optimistic)
 * mutate workload that pro-table, the base Table, and the resource controller
 * all consume from ONE engine. Supports both `paged` (replace on page change)
 * and `infinite` (append via loadMore) modes, with row-scoped mutate tracking.
 *
 * This is the public entry point / barrel. It re-exports from:
 *
 *   types.ts  — type declarations
 *   client.ts — createClientDataSource / createSyncClientDataSource
 *
 * createDataSource itself stays inline because it is the core factory and keeps
 * the mutation boundary next to the query lifecycle.
 */
import { createStore } from './store'
import {
  activeCacheFilters,
  canonicalJsonStringify,
  isJsonSafeValue,
  positiveInteger,
} from './data-source-cache-helpers'
import { createSelectionModel } from './selection'
import { createDataSourceMutationRuntime } from './data-source-mutations'
import type { DataSourceQueuedMutation } from './data-source-mutation-types'
import { pageCount as computePageCount } from './data-view'
import { createResilientFetcher } from './resilient-fetcher'
import {
  createOutbox,
  OutboxSerializationError,
  type AdvancedOutbox,
  type OutboxCodec,
  type OutboxStorage,
} from './outbox'
import { cloneRuntimeValue } from './outbox-runtime'
import {
  DataSourceMutationUndeliveredError,
  type DataSourceQuery,
  type DataSourceMode,
  type DataSourceConfig,
  type DataSourceState,
  type AdvancedDataSourceController,
  type DataSourceMutationDescriptor,
  type DataSourceOutboxOptions,
} from './data-source/types'

export type {
  DataSourceQuery,
  DataSourceMode,
  DataSourceConfig,
  DataSourceState,
  MutateOptions,
  RowMutateOptions,
  AdvancedDataSourceController,
  DataSourceController,
  DataSourceMutationDescriptor,
  DataSourceMutationOutcome,
  DataSourceOutboxOptions,
  DataSourceMutationStatus,
} from './data-source/types'
export {
  DataSourceMutationDeferredError,
  DataSourceMutationUndeliveredError,
} from './data-source/types'
export { createClientDataSource, createSyncClientDataSource } from './data-source/client'

function isThenable<T>(value: unknown): value is Promise<T> {
  return (
    value != null &&
    (typeof value === 'object' || typeof value === 'function') &&
    typeof (value as { then?: unknown }).then === 'function'
  )
}

const DEFAULT_PAGE_SIZE = 10

function nonNegativeInteger(value: number): number {
  return Number.isFinite(value) && value >= 0 ? Math.trunc(value) : 0
}

function cloneSort(sort: DataSourceQuery['sort']): DataSourceQuery['sort'] {
  return sort ? { ...sort } : null
}

function cloneMultiSort(multiSort: DataSourceQuery['multiSort']): DataSourceQuery['multiSort'] {
  return multiSort.map((sort) => ({ ...sort }))
}

function cloneFilterRules(
  filterRules: DataSourceQuery['filterRules'],
): DataSourceQuery['filterRules'] {
  return filterRules.map((rule) => ({ ...rule }))
}

class DataSourceEngine<T> {
  readonly controller: AdvancedDataSourceController<T>

  constructor(config: DataSourceConfig<T>) {
    const mode: DataSourceMode = config.mode ?? 'paged'
    const maxRows = config.maxRows ?? 5000
    const store = createStore<DataSourceState<T>>({
      rows: [],
      total: 0,
      page: 1,
      pageSize: positiveInteger(config.pageSize, DEFAULT_PAGE_SIZE),
      sort: null,
      multiSort: [],
      filters: {},
      filterRules: [],
      loading: false,
      loadingMore: false,
      error: undefined,
      hasMore: false,
      selectedKeys: [],
      pendingRows: [],
      rowErrors: {},
    })

    const selection = createSelectionModel({ mode: 'multiple' })
    let unsubSelection: (() => void) | undefined
    const ensureSelectionSubscription = (): void => {
      if (unsubSelection) return
      // A controller can be loaded again after destroy() (as framework bridges
      // do during StrictMode remounts). Reconcile direct selection changes made
      // while detached before resuming the subscription. Attach first so a
      // reentrant selection change from a reconciliation subscriber is not lost.
      unsubSelection = selection.store.subscribe((keys) =>
        store.setState((s) => ({ ...s, selectedKeys: [...keys] })),
      )
      store.setState((s) => ({ ...s, selectedKeys: [...selection.get()] }))
    }
    ensureSelectionSubscription()

    // Optional resilient fetcher wrapping the raw config.fetcher with
    // cache (dedup/TTL/SWR) + circuit breaker + rate limiter.
    const resilient = config.resilient
      ? createResilientFetcher<{ rows: T[]; total: number }>(config.resilient)
      : null

    type QueuedMutation = DataSourceQueuedMutation

    // Optional mutation outbox for offline-first, at-least-once delivery.
    // The no-storage branch intentionally retains the old closure payload API.
    // A supplied storage takes the explicit descriptor path instead, so a
    // function can never be handed to JSON/localStorage by accident.
    const outboxOpts = config.outbox
    const durableOutboxOpts: DataSourceOutboxOptions | undefined =
      typeof outboxOpts === 'object' ? outboxOpts : undefined
    const descriptorCodec: OutboxCodec<QueuedMutation, DataSourceMutationDescriptor> = {
      encode(mutation) {
        const descriptor = mutation.descriptor
        if (!descriptor || typeof descriptor.type !== 'string') {
          throw new OutboxSerializationError(
            'Data-source durable outbox mutations require options.descriptor; action closures are not persistable',
          )
        }
        return descriptor
      },
      decode(descriptor) {
        if (!descriptor || typeof descriptor.type !== 'string') {
          throw new OutboxSerializationError(
            'Data-source outbox descriptor must contain a string `type`',
          )
        }
        const executor = durableOutboxOpts?.executor
        return {
          description: `data-source:${descriptor.type}`,
          descriptor,
          run: executor
            ? () => executor(descriptor)
            : async () => {
                throw new DataSourceMutationUndeliveredError(
                  `No outbox executor is configured for descriptor type "${descriptor.type}"`,
                )
              },
        }
      },
    }
    const outbox = outboxOpts
      ? durableOutboxOpts?.storage !== undefined
        ? createOutbox<QueuedMutation, DataSourceMutationDescriptor>({
            execute: async (mutation) => {
              await mutation.run()
            },
            storage: durableOutboxOpts.storage as OutboxStorage<DataSourceMutationDescriptor>,
            codec: descriptorCodec,
            maxAttempts: durableOutboxOpts.maxAttempts,
          })
        : createOutbox<QueuedMutation>({
            execute: async (mutation) => {
              await mutation.run()
            },
            maxAttempts: durableOutboxOpts?.maxAttempts,
          })
      : null

    let epoch = 0
    let inFlight: AbortController | null = null
    let activeResilientKey: string | undefined
    // Unique-key counter for queries whose FilterRule.value is not JSON-serializable
    // (functions, cyclic objects, …): such a query can't share the cache, so each
    // call gets a fresh key — caching degrades to pass-through instead of throwing
    // mid-fetch (the key is only ever used as a Map key, never sent anywhere).
    let nonSerializableKey = 0

    const cacheKey = (query: DataSourceQuery): string => {
      try {
        // Fixed literal order — `ms`/`fr` complete the key so multiSort and
        // filterRules queries never collide with the initial page or each other.
        const payload = {
          page: query.page,
          ps: query.pageSize,
          s: query.sort,
          f: query.filters,
          ms: query.multiSort,
          fr: query.filterRules,
        }
        if (!isJsonSafeValue(payload)) throw new Error('query contains a non-JSON-safe value')
        // Normalize only the cache representation. The original query object,
        // including inactive filter entries, is still passed to config.fetcher.
        const canonicalPayload = { ...payload, f: activeCacheFilters(query.filters) }
        return canonicalJsonStringify(canonicalPayload)
      } catch {
        return `non-serializable:${++nonSerializableKey}`
      }
    }

    const buildQuery = (overridePage?: number): DataSourceQuery => {
      const s = store.getState()
      return {
        page: positiveInteger(overridePage ?? s.page, 1),
        pageSize: positiveInteger(s.pageSize, DEFAULT_PAGE_SIZE),
        sort: cloneSort(s.sort),
        multiSort: cloneMultiSort(s.multiSort),
        filters: { ...s.filters },
        filterRules: cloneFilterRules(s.filterRules),
      }
    }

    let canonicalRows: T[] = []
    let reapplyPendingOptimistic = (): void => {}

    const applyResult = (
      result: { rows: T[]; total: number },
      append: boolean,
      overridePage?: number,
    ): void => {
      const total = nonNegativeInteger(result.total)
      const ownedRows = cloneRuntimeValue(result.rows)
      canonicalRows = append ? [...canonicalRows, ...ownedRows] : ownedRows
      // Cap to maxRows in infinite mode to prevent unbounded accumulation
      if (mode === 'infinite' && canonicalRows.length > maxRows) {
        canonicalRows = canonicalRows.slice(0, maxRows)
      }
      store.setState((s) => {
        const nextRows = cloneRuntimeValue(canonicalRows)
        const page = overridePage ?? s.page
        const hasMore =
          mode === 'infinite' ? nextRows.length < total : computePageCount(total, s.pageSize) > page
        return {
          ...s,
          rows: nextRows,
          total,
          page,
          loading: false,
          loadingMore: false,
          error: undefined,
          hasMore,
        }
      })
      // A manual load may complete while an outbox mutation is deferred. The
      // server snapshot must not erase its still-pending optimistic layer.
      reapplyPendingOptimistic()
    }

    async function fetchPage(opts: { append: boolean; page?: number }): Promise<void> {
      ensureSelectionSubscription()
      const append = opts.append && mode === 'infinite'
      const token = ++epoch
      // Removing the data-source-owned entry is required before aborting: the
      // cache otherwise deduplicates the next same-key load onto this aborted
      // promise. Other cache entries remain available for normal hits/SWR.
      if (resilient && activeResilientKey !== undefined) {
        resilient.cache.remove(activeResilientKey)
        activeResilientKey = undefined
      }
      inFlight?.abort()
      const ac = typeof AbortController !== 'undefined' ? new AbortController() : null
      inFlight = ac
      const query = buildQuery(opts.page)

      try {
        let result: { rows: T[]; total: number }
        if (resilient) {
          store.setState((s) => ({ ...s, loading: !append, loadingMore: append, error: undefined }))
          const key = cacheKey(query)
          const request = resilient.fetch(
            key,
            async () => {
              return ac ? config.fetcher(query, ac.signal) : config.fetcher(query)
            },
            {
              staleWhileRevalidate: config.resilient?.staleWhileRevalidate ?? false,
            },
          )
          // A fresh cache hit is already resolved and must not be treated as
          // an active request that a following load needs to remove.
          if (resilient.cache.get(key)?.isFetching) activeResilientKey = key
          const raw = await request
          if (token !== epoch) return
          result = raw
        } else {
          const raw = ac ? config.fetcher(query, ac.signal) : config.fetcher(query)
          if (isThenable(raw)) {
            store.setState((s) => ({
              ...s,
              loading: !append,
              loadingMore: append,
              error: undefined,
            }))
            const awaited = await raw
            if (token !== epoch) return
            result = awaited
          } else {
            result = raw
          }
        }
        applyResult(result, append, opts.page)
      } catch (error) {
        if (token !== epoch) return
        if (ac?.signal.aborted) return
        store.setState((s) => ({ ...s, loading: false, loadingMore: false, error }))
      } finally {
        if (inFlight === ac) {
          inFlight = null
          activeResilientKey = undefined
        }
      }
    }

    const reloadFromStart = (): Promise<void> => {
      store.setState((s) => ({ ...s, page: 1 }))
      return fetchPage({ append: false, page: 1 })
    }

    /**
     * A successful mutation changes server state, so every cached query result is
     * stale. Two layers:
     *  - `invalidateAll()` marks all entries stale — SWR-serving readers still
     *    see data but re-fetch on their next read;
     *  - `remove(currentKey)` drops the CURRENT query's entry entirely. Its epoch
     *    bump orphans a pre-mutation in-flight fetch whose settle would otherwise
     *    re-fresh the entry with pre-mutation data — and the post-mutate `load()`
     *    would then short-circuit on that fresh entry, serving pre-mutation rows.
     * Only called on SUCCESS: on failure the server state is unchanged, so the
     * cache keeps serving the data it legitimately holds.
     */
    const invalidateAfterMutation = (): void => {
      if (!resilient) return
      resilient.cache.invalidateAll()
      resilient.cache.remove(cacheKey(buildQuery()))
    }

    const mutationRuntime = createDataSourceMutationRuntime<T>({
      store,
      outbox,
      reload: () => fetchPage({ append: false }),
      invalidateAfterMutation,
      getCanonicalRows: () => canonicalRows,
      setCanonicalRows: (rows) => {
        canonicalRows = rows
      },
    })
    reapplyPendingOptimistic = mutationRuntime.reapplyPendingOptimistic

    const controller: AdvancedDataSourceController<T> = {
      store,
      selection,
      getState: store.getState,
      subscribe: store.subscribe,
      load: () => {
        ensureSelectionSubscription()
        return fetchPage({ append: false })
      },
      reload: () => {
        ensureSelectionSubscription()
        return fetchPage({ append: false })
      },
      loadMore() {
        const s = store.getState()
        if (mode !== 'infinite' || !s.hasMore || s.loadingMore || s.loading)
          return Promise.resolve()
        if (s.rows.length >= maxRows) return Promise.resolve()
        return fetchPage({ append: true, page: s.page + 1 })
      },
      setPage(page) {
        const currentPage = positiveInteger(store.getState().page, 1)
        const nextPage = positiveInteger(page, currentPage)
        store.batch(() => {
          store.setState((s) => ({ ...s, page: nextPage }))
          void fetchPage({ append: false, page: nextPage })
        })
      },
      setPageSize(size) {
        const currentPageSize = positiveInteger(store.getState().pageSize, DEFAULT_PAGE_SIZE)
        const nextPageSize = positiveInteger(size, currentPageSize)
        store.batch(() => {
          store.setState((s) => ({ ...s, pageSize: nextPageSize, page: 1 }))
          void reloadFromStart()
        })
      },
      setSort(sort) {
        const nextSort = cloneSort(sort)
        store.batch(() => {
          store.setState((s) => ({ ...s, sort: nextSort, page: 1 }))
          void reloadFromStart()
        })
      },
      setMultiSort(multiSort) {
        const nextMultiSort = cloneMultiSort(multiSort)
        store.batch(() => {
          store.setState((s) => ({ ...s, multiSort: nextMultiSort, sort: null, page: 1 }))
          void reloadFromStart()
        })
      },
      setFilter(key, value) {
        store.batch(() => {
          store.setState((s) => ({ ...s, filters: { ...s.filters, [key]: value }, page: 1 }))
          void reloadFromStart()
        })
      },
      setFilterRules(rules) {
        const nextRules = cloneFilterRules(rules)
        store.batch(() => {
          store.setState((s) => ({ ...s, filterRules: nextRules, page: 1 }))
          void reloadFromStart()
        })
      },
      clearFilters() {
        store.batch(() => {
          store.setState((s) => ({ ...s, filters: {}, filterRules: [], page: 1 }))
          void reloadFromStart()
        })
      },
      pageCount: () => computePageCount(store.getState().total, store.getState().pageSize),
      hasMore: () => store.getState().hasMore,
      isRowPending: (rowKey) => store.getState().pendingRows.includes(rowKey),
      rowError: (rowKey) => store.getState().rowErrors[rowKey],
      async mutate(action, options) {
        const outcome = await mutationRuntime.mutate(action, options)
        mutationRuntime.throwIfUndelivered(outcome)
      },
      mutateResult: (action, options) => mutationRuntime.mutate(action, options),
      async mutateRow(rowKey, action, options) {
        const outcome = await mutationRuntime.mutateRow(rowKey, action, options)
        mutationRuntime.throwIfUndelivered(outcome)
      },
      mutateRowResult: (rowKey, action, options) =>
        mutationRuntime.mutateRow(rowKey, action, options),
      outbox: outbox ? (outbox as AdvancedOutbox<unknown>) : undefined,
      destroy() {
        mutationRuntime.destroy()
        unsubSelection?.()
        unsubSelection = undefined
        // The cache owns the shared in-flight promise. Drop its entries before
        // aborting so a request after destroy() cannot deduplicate onto it.
        resilient?.cache.clear()
        activeResilientKey = undefined
        epoch += 1
        inFlight?.abort()
        inFlight = null
      },
    }

    if (config.immediate !== false) void controller.load()

    this.controller = controller
  }
}

export function createDataSource<T>(config: DataSourceConfig<T>): AdvancedDataSourceController<T> {
  return new DataSourceEngine(config).controller
}
