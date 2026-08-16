import * as React from 'react'
import type {
  IrisTablePersistConfig,
  IrisTablePersistPiece,
  IrisTablePersistedState,
} from './types'

/**
 * Batch AG — the `persistState` coordinator for the CONTROLLED IrisTable.
 *
 * Every piece is parent-owned through its change callback, so this hook is a
 * pure LOADS/SAVES coordinator with zero new state: restore REPLAYS the stored
 * values through the callbacks; saves SERIALIZE the current props on every
 * change.
 *
 * Ordering contract (the mount commit must never overwrite storage with
 * pre-restore values): the restore effect is declared BEFORE the save
 * subscription and marks per-channel skip-first refs — the first save run
 * after a restore keeps the RESTORED values for those channels instead of
 * the pre-restore props values (the write stays idempotent with storage and
 * JSON-deduped).
 *
 * `pageSize` is the documented special case: no change callback exists (the
 * proxy `onPageChange` is a notification), so the Table's proxy-creation
 * effect performs the actual restore BEFORE the first query — see Table.tsx.
 * Eligibility here just mirrors that gate (a proxy with `onPageChange`).
 */
const ALL_PIECES: readonly IrisTablePersistPiece[] = [
  'sort',
  'multiSortState',
  'filters',
  'filterValues',
  'columnVisibility',
  'columnOrder',
  'columnWidths',
  'pageSize',
  'expandedKeys',
]

/** Default storage key (vxe has no equivalent — iris 独有 naming). */
export const IRIS_TABLE_PERSIST_DEFAULT_KEY = 'iris-table-state'

/** SSR-safe default adapter: localStorage when available (guarded). Shared by
 * `usePersistState` and the views hook (batch AH) — one guard, one truth. */
export function defaultStorage(): Pick<Storage, 'getItem' | 'setItem'> | null {
  if (typeof window === 'undefined') return null
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null
  } catch {
    return null
  }
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
  const out: IrisTablePersistedState = {}
  for (const piece of ALL_PIECES) {
    if (included && !included.has(piece)) continue
    const value = (parsed as Record<string, unknown>)[piece]
    if (value !== undefined) (out as Record<string, unknown>)[piece] = value
  }
  return out
}

export interface UsePersistStateOptions {
  /** The `persistState` prop (undefined → persistence fully off). */
  config: IrisTablePersistConfig | undefined
  /** Current values of ALL pieces, built from the live props each render (the
   * table is controlled). Null when `config` is absent. */
  state: IrisTablePersistedState | null
  /** Apply one restored piece through its change callback; return true when
   * the restore was actually dispatched (eligibility → per-channel
   * skip-first). */
  restorePiece: (piece: IrisTablePersistPiece, value: unknown) => boolean
}

/**
 * Mount-time snapshot (parsed once). Exposed so the Table's proxy-creation
 * effect can consume the restored `pageSize` BEFORE the first query fires.
 */
export function usePersistState(options: UsePersistStateOptions): {
  parsed: IrisTablePersistedState | null
} {
  const { config, state, restorePiece } = options

  // Parse ONCE. The lazy ref initializer runs during the first render — a
  // guarded, idempotent read — so effects declared earlier in the component
  // (the proxy-creation effect) can consume the restored pageSize.
  const parsedRef = React.useRef<IrisTablePersistedState | null>(null)
  const parsedLoadedRef = React.useRef(false)
  if (!parsedLoadedRef.current) {
    parsedLoadedRef.current = true
    parsedRef.current = readPersisted(config)
  }

  // Latest-closure refs: the mount-stable effects must never see a stale
  // callback/snapshot/config (same pattern as the table's other event refs).
  const restoreRef = React.useRef(restorePiece)
  restoreRef.current = restorePiece
  const stateRef = React.useRef(state)
  stateRef.current = state
  // Per-channel skip-first: set by the restore effect, consumed (cleared) by
  // the FIRST save run — the mount commit never overwrites storage with the
  // pre-restore values.
  const skipRef = React.useRef<Partial<Record<IrisTablePersistPiece, boolean>>>({})
  // JSON dedupe: only write when the serialized snapshot actually changed
  // (an idempotent re-render must not hammer the storage adapter).
  const lastWrittenRef = React.useRef<string | null>(null)

  // Restore (mount, declared BEFORE the save subscription): replay every
  // stored piece through its change callback. `pageSize` is dispatched as
  // eligible only when a proxy `onPageChange` exists — the Table's
  // proxy-creation effect performs the actual restore before the first query.
  React.useEffect(() => {
    const parsed = parsedRef.current
    if (!parsed) return
    const skip = skipRef.current
    for (const piece of ALL_PIECES) {
      const value = (parsed as Record<string, unknown>)[piece]
      if (value === undefined) continue
      if (restoreRef.current(piece, value)) skip[piece] = true
    }
  }, [])

  // Save: serialize the included pieces from the CURRENT props on every
  // change. A skip-first channel (just restored) keeps its RESTORED value
  // instead of the pre-restore props value — the mount commit never
  // overwrites storage; the whole-object write stays atomic and lossless.
  // Batch BZ (勘误): the collector memo is now UNCONDITIONAL (even a bare
  // table builds a snapshot for handle.exportStateJson) — the `hasConfig`
  // gate below is what keeps persist writes off when `persistState` is
  // absent: a views-only or bare table must never serialize into the
  // persist key.
  const hasConfig = config !== undefined
  const { storage, key, include } = config ?? {}
  React.useEffect(() => {
    if (!hasConfig || storage === false || state === null) return
    const store = storage ?? defaultStorage()
    if (!store) return
    const included = include ? new Set<IrisTablePersistPiece>(include) : null
    const out: IrisTablePersistedState = {}
    const skip = skipRef.current
    for (const piece of ALL_PIECES) {
      if (included && !included.has(piece)) continue
      const value = (state as Record<string, unknown>)[piece]
      if (value === undefined) continue
      if (skip[piece]) {
        skip[piece] = false
        const restored = (parsedRef.current as Record<string, unknown>)[piece]
        if (restored !== undefined) (out as Record<string, unknown>)[piece] = restored
        continue
      }
      ;(out as Record<string, unknown>)[piece] = value
    }
    // Nothing the parent owns → nothing to write (also protects the mount
    // commit after a full-channel restore from clobbering storage with {}).
    if (Object.keys(out).length === 0) return
    const json = JSON.stringify(out)
    if (json === lastWrittenRef.current) return
    try {
      store.setItem(key ?? IRIS_TABLE_PERSIST_DEFAULT_KEY, json)
      lastWrittenRef.current = json
    } catch {
      // Quota / security errors must never break the table.
    }
  }, [state, storage, key, include, hasConfig])

  return { parsed: parsedRef.current }
}
