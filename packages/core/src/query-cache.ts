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
  const entries = new Map<string, InternalEntry<T>>()
  const listeners = new Map<string, Set<(entry: QueryEntry<T>) => void>>()

  const ensure = (key: string): InternalEntry<T> => {
    let e = entries.get(key)
    if (!e) {
      e = idleEntry<T>()
      entries.set(key, e)
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
    e.isFetching = true
    if (e.status === 'idle') e.status = 'loading'
    emit(key, e)
    // Call the fetcher EAGERLY (synchronously) so de-dup counting and the shared
    // promise are observable at once; a synchronous throw becomes a rejection.
    let raw: Promise<T>
    try {
      raw = Promise.resolve(fetcher(key))
    } catch (err) {
      raw = Promise.reject(err)
    }
    const p = raw.then(
      (data) => {
        const cur = entries.get(key)
        // Ignore a settle for a key that was removed/cleared mid-flight.
        if (!cur || cur.epoch !== startEpoch) return data
        cur.data = data
        cur.error = undefined
        cur.status = 'success'
        cur.updatedAt = now()
        cur.isFetching = false
        cur.stale = false
        cur.inflight = undefined
        emit(key, cur)
        return data
      },
      (err) => {
        const cur = entries.get(key)
        if (!cur || cur.epoch !== startEpoch) throw err
        cur.error = err
        cur.status = 'error'
        cur.isFetching = false
        cur.inflight = undefined
        emit(key, cur)
        throw err
      },
    )
    e.inflight = p
    return p
  }

  return {
    get(key) {
      const e = entries.get(key)
      return e ? snapshot(e) : undefined
    },
    fetch(key, fetcher, opts = {}) {
      const e = ensure(key)
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
      e.data = data
      e.error = undefined
      e.status = 'success'
      e.updatedAt = now()
      e.isFetching = false
      e.stale = false
      emit(key, e)
    },
    invalidate(key) {
      const e = entries.get(key)
      if (!e) return
      // Force staleness without dropping data (SWR can still serve it).
      e.stale = true
      emit(key, e)
    },
    invalidateAll() {
      for (const [key, e] of entries) {
        e.stale = true
        emit(key, e)
      }
    },
    remove(key) {
      const e = entries.get(key)
      if (e) e.epoch += 1 // orphan any in-flight settle
      entries.delete(key)
    },
    clear() {
      for (const e of entries.values()) e.epoch += 1
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
