import type {
  IrisTablePersistConfig,
  IrisTablePersistPiece,
  IrisTablePersistedState,
} from './types'

/**
 * Batch EJ — the `persistState` LOADS/SAVES coordinator for the CONTROLLED
 * IrisTable (mirror of the react `usePersistState` hook, runes-ified; iris
 * 独有 — vxe has no built-in state persistence).
 *
 * Every piece is parent-owned through its change callback, so this controller
 * is a pure LOADS/SAVES coordinator with zero new state: restore REPLAYS the
 * stored values through the callbacks (the table component owns `restorePiece`
 * — one per-channel gate with type guards); saves SERIALIZE the current props
 * snapshot on every change.
 *
 * Ordering contract (the mount commit must never overwrite storage with
 * pre-restore values): the table declares its restore before the save
 * subscription and marks per-channel skip-first refs here — the first save
 * run after a restore keeps the RESTORED values for those channels instead of
 * the pre-restore props values (the write stays idempotent with storage and
 * JSON-deduped).
 *
 * `pageSize` is the documented special case: no change callback exists (the
 * proxy `onPageChange` is a notification), so the table's proxy-creation
 * effect performs the actual restore BEFORE the first query. Eligibility here
 * just mirrors that gate (a proxy with `onPageChange`).
 */
const ALL_PIECES: readonly IrisTablePersistPiece[] = [
  'sort',
  'filters',
  'columnVisibility',
  'columnOrder',
  'columnWidths',
  'pageSize',
]

/** Default storage key (vxe has no equivalent — iris 独有 naming). */
export const IRIS_TABLE_PERSIST_DEFAULT_KEY = 'iris-table-state'

/** SSR-safe default adapter: localStorage when available (guarded). Shared
 * with the views controller — one guard, one truth. */
export function defaultStorage(): Pick<Storage, 'getItem' | 'setItem'> | null {
  if (typeof window === 'undefined') return null
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null
  } catch {
    return null
  }
}

/** Copy the defined + included pieces from a parsed snapshot into a clean
 * `IrisTablePersistedState` — shared by the parse and the include filter. */
function collectIncluded(
  parsed: Record<string, unknown>,
  included: Set<IrisTablePersistPiece> | null,
): IrisTablePersistedState {
  const out: IrisTablePersistedState = {}
  for (const piece of ALL_PIECES) {
    if (included && !included.has(piece)) continue
    const value = parsed[piece]
    if (value !== undefined) (out as Record<string, unknown>)[piece] = value
  }
  return out
}

/** Read + parse + sanitize the persisted snapshot. Any failure → null
 * (missing key / corrupt JSON / non-object value are all ignored). The
 * window guard makes the parse a strict no-op during SSR — the restore
 * happens in effects, which never run server-side. */
function readPersisted(config: IrisTablePersistConfig | undefined): IrisTablePersistedState | null {
  if (!config || config.storage === false) return null
  if (typeof window === 'undefined') return null
  const store = config.storage ?? defaultStorage()
  if (!store) return null
  let raw: string | null
  try {
    raw = store.getItem(config.key ?? IRIS_TABLE_PERSIST_DEFAULT_KEY)
  } catch {
    return null
  }
  if (!raw) return null
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return null
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return null
  const included = config.include ? new Set<IrisTablePersistPiece>(config.include) : null
  return collectIncluded(parsed as Record<string, unknown>, included)
}

/** Build the save snapshot with per-channel skip-first: a channel that was
 * just RESTORED keeps its restored value (the mount commit never overwrites
 * storage with pre-restore props values). */
function buildSaveSnapshot(
  state: IrisTablePersistedState,
  included: Set<IrisTablePersistPiece> | null,
  skip: Partial<Record<IrisTablePersistPiece, boolean>>,
  parsed: IrisTablePersistedState | null,
): IrisTablePersistedState {
  const out: IrisTablePersistedState = {}
  for (const piece of ALL_PIECES) {
    if (included && !included.has(piece)) continue
    const value = (state as Record<string, unknown>)[piece]
    if (value === undefined) continue
    if (skip[piece]) {
      skip[piece] = false
      const restored = (parsed as Record<string, unknown> | null)?.[piece]
      if (restored !== undefined) (out as Record<string, unknown>)[piece] = restored
      continue
    }
    ;(out as Record<string, unknown>)[piece] = value
  }
  return out
}

export interface TablePersistOptions {
  /** The `persistState` prop (undefined → persistence fully off). */
  config: () => IrisTablePersistConfig | undefined
  /** Apply one restored piece through its change callback; return true when
   * the restore was actually dispatched (eligibility → per-channel
   * skip-first). Must read LIVE props (never a stale snapshot). */
  restorePiece: (piece: IrisTablePersistPiece, value: unknown) => boolean
}

/**
 * Mount-time snapshot (parsed once at setup — a guarded, idempotent read, so
 * the proxy-creation effect can consume the restored `pageSize` BEFORE the
 * first query fires). `restore()` is the mount replay; `save()` serializes
 * the current pieces with per-channel skip-first + whole-object JSON dedupe.
 */
export function createTablePersistController(options: TablePersistOptions): {
  readonly parsed: IrisTablePersistedState | null
  /** Mount restore: replay every stored piece through the change callbacks
   * (`pageSize` only declares eligibility — the proxy effect applies it). */
  restore: () => void
  /** Save the current snapshot when the caller's reactive state changed. */
  save: (config: IrisTablePersistConfig | undefined, state: IrisTablePersistedState) => void
} {
  // Parse ONCE (setup runs once per component instance).
  const parsed = readPersisted(options.config())
  // Per-channel skip-first: set by restore(), consumed (cleared) by the FIRST
  // save call — the mount commit never overwrites storage with the
  // pre-restore values for a channel that was just restored.
  const skip: Partial<Record<IrisTablePersistPiece, boolean>> = {}
  // JSON dedupe: only write when the serialized snapshot actually changed
  // (an idempotent re-run must not hammer the storage adapter).
  let lastWritten: string | null = null

  return {
    get parsed() {
      return parsed
    },
    restore() {
      if (!parsed) return
      for (const piece of ALL_PIECES) {
        const value = (parsed as Record<string, unknown>)[piece]
        if (value === undefined) continue
        if (options.restorePiece(piece, value)) skip[piece] = true
      }
    },
    save(config, state) {
      // hasConfig gate (react parity): a bare table / views-only table that
      // never passes `persistState` must not serialize into the persist key.
      if (config === undefined || config.storage === false) return
      const store = config.storage ?? defaultStorage()
      if (!store) return
      const included = config.include ? new Set<IrisTablePersistPiece>(config.include) : null
      const out = buildSaveSnapshot(state, included, skip, parsed)
      // Nothing the parent owns → nothing to write (also protects the mount
      // commit after a full-channel restore from clobbering storage with {}).
      if (Object.keys(out).length === 0) return
      const json = JSON.stringify(out)
      if (json === lastWritten) return
      try {
        store.setItem(config.key ?? IRIS_TABLE_PERSIST_DEFAULT_KEY, json)
        lastWritten = json
      } catch {
        // Quota / security errors must never break the table.
      }
    },
  }
}
