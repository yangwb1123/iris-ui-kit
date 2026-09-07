/**
 * `@iris-ui-kit/core` query cache — framework-agnostic request de-duplication,
 * TTL caching, and stale-while-revalidate (SWR) over any async fetcher. The
 * data engines (`createDataSource`, `createResource`) are single-fetcher and
 * pull-based: every caller triggers its own request, nothing is shared or
 * cached, and a re-fetch always blanks the UI. This is the layer above them —
 * concurrent callers for the same key share one in-flight promise, successful
 * results are cached for a freshness window, and a stale entry can be served
 * instantly while a refresh runs in the background.
 *
 * Pure and DOM-free: keyed by string (callers serialize their query params, as
 * every query-cache does), with an injectable clock for deterministic TTL tests.
 */

export type QueryStatus = 'idle' | 'loading' | 'success' | 'error'

/** A cache entry's observable state. */
export interface QueryEntry<T> {
  data: T | undefined
  error: unknown
  status: QueryStatus
  /** ms-epoch of the last successful load; `0` if never loaded. */
  updatedAt: number
  /** `true` when a background refresh is in flight over existing data. */
  isFetching: boolean
}

export interface QueryCacheOptions {
  /** Freshness window in ms. Within it, `fetch` returns cached data without
   *  hitting the fetcher. Default `0` (data is immediately stale). */
  ttlMs?: number
  /** Injectable clock (ms). Defaults to `Date.now`. */
  now?: () => number
  /** Maximum entries retained. Non-finite values are unbounded; finite values are floored and clamped at zero. */
  maxEntries?: number
}

export interface QueryFetchOptions {
  /** Serve a stale-but-present entry immediately and refresh in the background
   *  (SWR). Without it, a stale key awaits a fresh fetch. Default `false`. */
  staleWhileRevalidate?: boolean
  /** Bypass the cache and force a fetch (still de-duplicated). Default `false`. */
  force?: boolean
}

export interface QueryCache<T> {
  /** Current entry for `key` (or `undefined` if never touched). */
  get(key: string): QueryEntry<T> | undefined
  /**
   * Return fresh cached data, a shared in-flight promise (de-dup), or a new
   * fetch — honoring `ttl`, `staleWhileRevalidate`, and `force`.
   */
  fetch(key: string, fetcher: (key: string) => Promise<T>, options?: QueryFetchOptions): Promise<T>
  /** Seed/overwrite an entry as freshly-loaded (e.g. optimistic or SSR data). */
  set(key: string, data: T): void
  /** Mark an entry stale so the next `fetch` refetches (data is retained). */
  invalidate(key: string): void
  /** Invalidate every entry. */
  invalidateAll(): void
  /** Drop an entry (and cancel-observing its in-flight result) entirely. */
  remove(key: string): void
  /** Drop everything. */
  clear(): void
  /** Observe an entry; the listener fires on every state change for `key`. */
  subscribe(key: string, listener: (entry: QueryEntry<T>) => void): () => void
}

interface InternalEntry<T> extends QueryEntry<T> {
  /** Shared in-flight promise for de-duplication (undefined when settled). */
  inflight?: Promise<T>
  /** Explicitly invalidated — treated as stale regardless of the clock. */
  stale: boolean
  /** Bumped on remove/clear so a late settle for a dropped key is ignored. */
  epoch: number
}

function idleEntry<T>(): InternalEntry<T> {
  return {
    data: undefined,
    error: undefined,
    status: 'idle',
    updatedAt: 0,
    isFetching: false,
    stale: false,
    epoch: 0,
  }
}

function snapshot<T>(e: InternalEntry<T>): QueryEntry<T> {
  return {
    data: e.data,
    error: e.error,
    status: e.status,
    updatedAt: e.updatedAt,
    isFetching: e.isFetching,
  }
}

export function createQueryCache<T>(options: QueryCacheOptions = {}): QueryCache<T> {
  const ttlMs = options.ttlMs ?? 0
  const now = options.now ?? (() => Date.now())
  // Undefined and non-finite capacities retain the historical unbounded
  // behavior. Finite values are deterministic integer capacities; zero is a
  // useful explicit way to disable retention.
  const maxEntries =
    options.maxEntries === undefined
      ? Infinity
      : Math.max(0, Math.floor(Number.isFinite(options.maxEntries) ? options.maxEntries : Infinity))
  const entries = new Map<string, InternalEntry<T>>()
  const listeners = new Map<string, Set<(entry: QueryEntry<T>) => void>>()

  // Map insertion order is the LRU order: the first entry is least recently
  // used and the last entry is most recently used.
  const touch = (key: string, e: InternalEntry<T>): void => {
    if (entries.get(key) !== e) return
    entries.delete(key)
    entries.set(key, e)
  }

  // A cache mutation supersedes any request already attached to this entry.
  // Clearing the promise is important for the next fetch to start a new
  // request; bumping the epoch makes the old request's settlement inert.
  const orphanInflight = (e: InternalEntry<T>): void => {
    e.epoch += 1
    e.inflight = undefined
    e.isFetching = false
  }

  const evictIfNeeded = (protectedKey?: string): void => {
    while (entries.size > maxEntries) {
      const oldest = entries.entries().next().value as [string, InternalEntry<T>] | undefined
      if (!oldest) return
      const [key, e] = oldest
      // Even a zero-capacity cache needs a live entry while a same-key request
      // is in flight so concurrent callers can still de-duplicate onto it.
      if (key === protectedKey) return
      entries.delete(key)
      orphanInflight(e)
    }
  }

  const ensure = (key: string, protectNewEntry = false): InternalEntry<T> => {
    let e = entries.get(key)
    if (!e) {
      e = idleEntry<T>()
      entries.set(key, e)
      evictIfNeeded(protectNewEntry ? key : undefined)
    } else {
      touch(key, e)
    }
    return e
  }

  const emit = (key: string, e: InternalEntry<T>): void => {
    const set = listeners.get(key)
    if (!set) return
    const snap = snapshot(e)
    for (const l of set) l(snap)
  }

  const isFresh = (e: InternalEntry<T>): boolean =>
    e.status === 'success' && !e.stale && now() - e.updatedAt < ttlMs

  const runFetch = (
    key: string,
    e: InternalEntry<T>,
    fetcher: (key: string) => Promise<T>,
  ): Promise<T> => {
    if (e.inflight) return e.inflight // de-dup: share the pending request
    const startEpoch = e.epoch
    // Install the shared promise BEFORE notifying subscribers or calling the
    // fetcher. Both callbacks are synchronous extension points: a re-entrant
    // fetch must deduplicate, while set/invalidate must supersede this
    // generation instead of leaving an unresolved orphan attached to the entry.
    let resolveRaw!: (data: T) => void
    let rejectRaw!: (error: unknown) => void
    const p = new Promise<T>((resolve, reject) => {
      resolveRaw = resolve
      rejectRaw = reject
    })
    e.inflight = p
    e.isFetching = true
    if (e.status === 'idle') e.status = 'loading'
    emit(key, e)
    let raw: Promise<T>
    try {
      raw = Promise.resolve(fetcher(key))
    } catch (err) {
      raw = Promise.reject(err)
    }
    void raw.then(resolveRaw, rejectRaw)
    void p
      .then(
        (data) => {
          const cur = entries.get(key)
          // Ignore a settle for a key that was removed/cleared mid-flight. The
          // key may already have been recreated, so epoch alone is not enough.
          if (cur !== e || cur.epoch !== startEpoch) return data
          cur.data = data
          cur.error = undefined
          cur.status = 'success'
          cur.updatedAt = now()
          cur.isFetching = false
          cur.stale = false
          cur.inflight = undefined
          touch(key, cur)
          emit(key, cur)
          evictIfNeeded()
          return data
        },
        (err) => {
          const cur = entries.get(key)
          // As above, do not let a removed entry settle into its replacement.
          if (cur !== e || cur.epoch !== startEpoch) throw err
          cur.error = err
          cur.status = 'error'
          cur.isFetching = false
          cur.inflight = undefined
          emit(key, cur)
          evictIfNeeded()
          throw err
        },
      )
      .catch(() => {
        // The original promise remains the caller-facing rejection; this
        // observer must not create a second unhandled rejection.
      })
    return p
  }

  return {
    get(key) {
      const e = entries.get(key)
      if (!e) return undefined
      touch(key, e)
      return snapshot(e)
    },
    fetch(key, fetcher, opts = {}) {
      const e = ensure(key, true)
      if (!opts.force && isFresh(e)) return Promise.resolve(e.data as T)
      const hasData = e.status === 'success'
      if (opts.staleWhileRevalidate && hasData && !opts.force) {
        // Serve stale data now; refresh in the background (de-dup guarded).
        void runFetch(key, e, fetcher).catch(() => {
          /* surfaced via entry.error + subscribers */
        })
        return Promise.resolve(e.data as T)
      }
      return runFetch(key, e, fetcher)
    },
    set(key, data) {
      const e = ensure(key)
      orphanInflight(e)
      e.data = data
      e.error = undefined
      e.status = 'success'
      e.updatedAt = now()
      e.isFetching = false
      e.stale = false
      emit(key, e)
      // A zero-capacity cache may keep an entry transiently while a request is
      // in flight. Once set() turns it into settled data, release that entry
      // instead of retaining a value beyond the configured capacity.
      evictIfNeeded()
    },
    invalidate(key) {
      const e = entries.get(key)
      if (!e) return
      touch(key, e)
      orphanInflight(e)
      // Force staleness without dropping data (SWR can still serve it).
      e.stale = true
      emit(key, e)
      evictIfNeeded()
    },
    invalidateAll() {
      // Snapshot first because listeners may re-enter and mutate the cache.
      for (const [key, e] of [...entries]) {
        if (entries.get(key) !== e) continue
        touch(key, e)
        orphanInflight(e)
        e.stale = true
        emit(key, e)
        evictIfNeeded()
      }
    },
    remove(key) {
      const e = entries.get(key)
      if (e) orphanInflight(e)
      entries.delete(key)
    },
    clear() {
      for (const e of entries.values()) orphanInflight(e)
      entries.clear()
    },
    subscribe(key, listener) {
      let set = listeners.get(key)
      if (!set) {
        set = new Set()
        listeners.set(key, set)
      }
      set.add(listener)
      return () => {
        const s = listeners.get(key)
        if (!s) return
        s.delete(listener)
        if (s.size === 0) listeners.delete(key)
      }
    },
  }
}
