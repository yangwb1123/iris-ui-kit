/**
 * `createRecentFilters` — a bounded, newest-first ring of recently applied
 * filter sets (batch CB, iris 独有 — vxe has no "recent filters" concept;
 * its filter panel is stateless per open).
 *
 * Framework-agnostic, no side-effects or timers. A single factory
 * (`createRecentFilters`) builds a ring you `record` one entry per filter
 * confirm into, cloning the `createAuditLog` factory mold (bounded,
 * `ensureBound` trim from the oldest end) plus its `subscribe(cb)` +
 * `getVersion()` store-bridge pair, so any framework adapter can bridge it
 * with its own reactivity (`useSyncExternalStore` / `ref` + subscription /
 * `createSignal` / `toStore`).
 *
 * The IrisTable integration (batch CB, react) records ONE entry per
 * filter-panel confirm — the column key + the checked values. Entries are
 * newest-first and de-duplicated by (key, values-SET) to the top (MRU): a
 * re-confirm with the same checkbox set (in any click order) bumps the
 * existing entry instead of duplicating it. Empty sets are NEVER recorded by
 * the integration (empty = the clear semantics, `mergeFilterValues`
 * precedent) — the ring itself is a generic container and does not gate.
 * Exported through the core barrel only (no own subpath).
 */

/** One recently applied filter set. */
export interface RecentFilterEntry {
  /** Column key the filter was confirmed on. */
  key: string
  /** Checked filter values (the integration only records non-empty sets). */
  values: string[]
  /** Epoch ms when the entry was recorded (re-bumped when MRU re-pushed). */
  ts: number
}

export interface RecentFiltersOptions {
  /**
   * Maximum entries retained. Default: 10. Oldest entries are trimmed off
   * the ring; `0` disables the bound (unlimited).
   */
  limit?: number
}

export interface RecentFilters {
  /**
   * Record a filter confirm. Newest-first; an existing entry with the same
   * key AND the same values SET (order-insensitive) is re-pushed to the
   * top (MRU, `ts` bumped). `limit`-bounded — oldest entries drop off the
   * ring. Notifies subscribers.
   */
  record(key: string, values: string[]): void

  /** Newest-first snapshot of the trail (a copy — mutating it is safe). */
  list(): readonly RecentFilterEntry[]

  /** Wipe every entry. Notifies subscribers. */
  clear(): void

  /** Subscribe to changes (record/clear). Returns an unsubscribe function. */
  subscribe(cb: () => void): () => void

  /** Monotonic change counter — the `getSnapshot` for `useSyncExternalStore`. */
  getVersion(): number

  /** Number of entries currently retained. */
  readonly depth: number
}

export function createRecentFilters(options: RecentFiltersOptions = {}): RecentFilters {
  const limit = options.limit ?? 10
  // Newest-first internally — unshift on record, trim (pop) from the oldest
  // end keeps `list()` allocation-free of reordering.
  const entries: RecentFilterEntry[] = []
  let version = 0
  const listeners = new Set<() => void>()

  const emit = (): void => {
    version += 1
    for (const cb of listeners) cb()
  }

  const ensureBound = (): void => {
    if (limit <= 0) return
    while (entries.length > limit) entries.pop()
  }

  // Canonical (key, values-set) identity — order-insensitive, so a re-confirm
  // with the same checkbox set in a different click order bumps the existing
  // entry (MRU) instead of duplicating it. `\u0000` cannot appear in values.
  const canonical = (key: string, values: string[]): string =>
    `${key}\u0000${[...values].sort().join('\u0000')}`

  const recent: RecentFilters = {
    record(key, values) {
      const sig = canonical(key, values)
      const existing = entries.findIndex((e) => canonical(e.key, e.values) === sig)
      if (existing !== -1) entries.splice(existing, 1)
      entries.unshift({ key, values: [...values], ts: Date.now() })
      ensureBound()
      emit()
    },
    list() {
      return entries.map((e) => ({ ...e, values: [...e.values] }))
    },
    clear() {
      if (entries.length === 0) return
      entries.length = 0
      emit()
    },
    subscribe(cb) {
      listeners.add(cb)
      return () => {
        listeners.delete(cb)
      }
    },
    getVersion() {
      return version
    },
    get depth() {
      return entries.length
    },
  }
  return recent
}
