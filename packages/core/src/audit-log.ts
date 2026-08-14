/**
 * `@iris-ui-kit/core/audit-log` — a bounded, append-only mutation audit trail.
 * Framework-agnostic, no side-effects or timers. A single factory
 * (`createAuditLog`) builds a ring you `push` one entry per commit into,
 * with a monotonic sequence number that NEVER resets on `clear` (audit
 * integrity — a cleared trail restarts at a higher seq, never at 0).
 *
 * Clones the `createUndoStack` factory mold (bounded, `ensureBound` trim
 * from the oldest end) plus the `createCellRange` subscribe shape, so any
 * framework adapter can bridge it with its own reactivity
 * (`useSyncExternalStore` / `ref` + subscription / `createSignal` /
 * `toStore` — the controller already exposes the `subscribe(cb)` +
 * `getVersion()` pair that store bridge expects).
 *
 * The IrisTable integration (batch AT, react) records ONE entry per
 * mutation commit: the type hint (edit / insert / remove / paste / batch /
 * fill / undo / redo) comes from the mutation site, while the row key +
 * first-changed-cell context comes from a light diff of the row lists.
 *
 * Off the core path (`@iris-ui-kit/core/audit-log` — own subpath).
 */

/** Commit kinds recorded by the audit trail. */
export type AuditLogType =
  'edit' | 'insert' | 'remove' | 'paste' | 'batch' | 'fill' | 'undo' | 'redo'

/**
 * One audit entry. `seq` and `at` are filled by the controller at push
 * time — callers provide everything else (`type` plus whatever diff context
 * they resolved; row-level structural changes carry only `rowKey`).
 */
export interface AuditLogEntry {
  /** Monotonic sequence number (never resets on clear — audit integrity). */
  seq: number
  /** Epoch ms when the entry was pushed. */
  at: number
  /** Commit kind — see {@link AuditLogType}. */
  type: AuditLogType
  /** Key of the first changed row (undefined when none could be resolved). */
  rowKey?: string | number
  /** Column key of the first changed cell (undefined for row-level ops). */
  column?: string
  /** Value before the change (muted `old → new` in the UI). */
  oldValue?: unknown
  /** Value after the change. */
  newValue?: unknown
}

export interface AuditLogOptions {
  /**
   * Maximum entries retained. Default: 200. Oldest entries are trimmed off
   * the ring; `0` disables the bound (unlimited).
   */
  limit?: number
}

export interface AuditLog {
  /**
   * Append an entry (fills `seq` + `at`). `limit`-bounded — oldest entries
   * drop off the ring. Notifies subscribers.
   */
  push(entry: Omit<AuditLogEntry, 'seq' | 'at'>): AuditLogEntry

  /** Newest-first snapshot of the trail (a copy — mutating it is safe). */
  list(): readonly AuditLogEntry[]

  /** Wipe every entry. The `seq` counter never resets — audit integrity. */
  clear(): void

  /** Subscribe to changes (push/clear). Returns an unsubscribe function. */
  subscribe(cb: () => void): () => void

  /** Monotonic change counter — the `getSnapshot` for `useSyncExternalStore`. */
  getVersion(): number

  /** Number of entries currently retained. */
  readonly depth: number
}

export function createAuditLog(options: AuditLogOptions = {}): AuditLog {
  const limit = options.limit ?? 200
  // Newest-first internally — unshift on push, trim (pop) from the oldest
  // end keeps `list()` allocation-free of reordering.
  const entries: AuditLogEntry[] = []
  // Monotonic sequence — deliberately module-local, never reset by clear().
  let seq = 0
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

  const audit: AuditLog = {
    push(entry) {
      seq += 1
      const full: AuditLogEntry = { ...entry, seq, at: Date.now() }
      entries.unshift(full)
      ensureBound()
      emit()
      return full
    },
    list() {
      return entries.map((e) => ({ ...e }))
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
  return audit
}
