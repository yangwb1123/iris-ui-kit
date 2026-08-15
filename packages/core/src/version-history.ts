/**
 * `@iris-ui-kit/core/version-history` — a bounded ring of row-list snapshots
 * for time-travel restore (batch BA, iris 独有 — vxe has no version history).
 * Framework-agnostic, no side-effects or timers. A single factory
 * (`createVersionHistory`) builds a ring you `push` ONE entry per row-list
 * commit into: the PRE-change rows + the commit's type hint.
 *
 * Clones the `createAuditLog` factory mold (bounded ring, newest-first
 * `unshift` + `pop` trim, monotonic `index` that NEVER resets on `clear`)
 * plus the `createCellRange` subscribe shape, so any framework adapter can
 * bridge it with its own reactivity (`useSyncExternalStore` / `ref` +
 * subscription / `createSignal` / `toStore` — the controller already exposes
 * the `subscribe(cb)` + `getVersion()` pair that store bridge expects).
 *
 * The IrisTable integration (batch BA, react) records ONE version per
 * `commitRowList` commit: the rows BEFORE the change (the exact state a
 * restore returns to) plus the same `AuditLogType` hint the batch-AT audit
 * funnel carries (edit / insert / remove / paste / batch / fill / undo /
 * redo). Restoring a version routes through the normal write-back channel
 * (`commitRowList(rows, 'undo')` — auditable and undoable) with a suppress
 * flag so the replay itself never pushes a new version. Inline cell/row
 * edits (the `commitValue` funnel) deliberately do NOT create versions —
 * restore replaces the whole row list, so row-level commits are the
 * coherent unit (documented).
 *
 * Off the core path (`@iris-ui-kit/core/version-history` — own subpath).
 */

import type { AuditLogType } from './audit-log'

/**
 * One version entry. `index` and `at` are filled by the controller at push
 * time — callers provide the pre-change rows plus whatever commit type hint
 * the mutation site carried. `rows` is the shared row-list reference (the
 * table's immutable-row contract makes snapshots safe to hold).
 */
export interface VersionHistoryEntry<Row> {
  /** Monotonic version index — the entry's slot in the version stream (never resets on clear). */
  index: number
  /** Epoch ms when the version was pushed. */
  at: number
  /** The row list BEFORE the commit — the exact state `get(index)` restores to. */
  rows: readonly Row[]
  /** Commit-kind hint — see {@link AuditLogType}. */
  type: AuditLogType
}

export interface VersionHistoryOptions {
  /**
   * Maximum versions retained. Default: 20. Oldest versions are trimmed off
   * the ring; `0` disables the bound (unlimited).
   */
  max?: number
}

export interface VersionHistory<Row> {
  /**
   * Append a version (the pre-change rows + type hint; fills `index` + `at`).
   * `max`-bounded — oldest versions drop off the ring. Notifies subscribers.
   */
  push(rows: readonly Row[], type?: AuditLogType): VersionHistoryEntry<Row>

  /** Newest-first snapshot of the ring (entry copies — mutating them is safe; rows stay shared references). */
  list(): readonly VersionHistoryEntry<Row>[]

  /**
   * The entry with `index` (an entry copy — the rows array is the shared
   * reference), or undefined when the ring no longer holds it (trimmed or
   * cleared).
   */
  get(index: number): VersionHistoryEntry<Row> | undefined

  /** Wipe every version. The `index` counter never resets — the version stream is monotonic. */
  clear(): void

  /** Subscribe to changes (push/clear). Returns an unsubscribe function. */
  subscribe(cb: () => void): () => void

  /** Monotonic change counter — the `getSnapshot` for `useSyncExternalStore`. */
  getVersion(): number

  /** Number of versions currently retained. */
  readonly depth: number
}

export function createVersionHistory<Row>(
  options: VersionHistoryOptions = {},
): VersionHistory<Row> {
  const max = options.max ?? 20
  // Newest-first internally — unshift on push, trim (pop) from the oldest
  // end keeps `list()` allocation-free of reordering.
  const entries: VersionHistoryEntry<Row>[] = []
  // Monotonic version index — deliberately module-local, never reset by
  // clear(). Starts at 0: the FIRST commit is version 0 (no initial seed —
  // the pre-change rows of commit 0 ARE the initial state, baseline F3).
  let index = 0
  let version = 0
  const listeners = new Set<() => void>()

  const emit = (): void => {
    version += 1
    for (const cb of listeners) cb()
  }

  const ensureBound = (): void => {
    if (max <= 0) return
    while (entries.length > max) entries.pop()
  }

  const history: VersionHistory<Row> = {
    push(rows, type = 'edit') {
      const full: VersionHistoryEntry<Row> = { index, at: Date.now(), rows, type }
      index += 1
      entries.unshift(full)
      ensureBound()
      emit()
      return full
    },
    list() {
      return entries.map((e) => ({ ...e }))
    },
    get(i) {
      const entry = entries.find((e) => e.index === i)
      return entry === undefined ? undefined : { ...entry }
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
  return history
}
