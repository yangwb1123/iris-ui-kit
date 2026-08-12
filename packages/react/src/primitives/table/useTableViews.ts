import * as React from 'react'
import { defaultStorage } from './usePersistState'
import type { IrisTablePersistedState } from './types'

/**
 * One named view preset (batch AH, iris 独有): a user-saved snapshot of the
 * table's persistable state pieces — the SAME shape `persistState` loads and
 * saves, captured by the same collector and applied through the same change
 * callbacks.
 */
export interface IrisTableNamedView {
  /** View name (also the view's key in the toolbar select). */
  name: string
  /** The state pieces captured when the view was saved. */
  snapshot: IrisTablePersistedState
}

/**
 * Named view presets (batch AH, iris 独有 — vxe has no equivalent; its
 * closest is manual state saving). The toolbar renders a compact select
 * (`data-iris-table-views`) of user-saved snapshots: picking a view replays
 * its snapshot through the change callbacks (same per-piece gating as
 * `persistState`; `pageSize` reproduces the mount-restore sequence
 * `onPageChange(1, size)` + one request); the "＋ 保存" item opens an inline
 * input (`data-iris-views-save`) that snapshots the CURRENT pieces under a
 * typed name (duplicate names upsert); the × button deletes the active view.
 * Views load from storage on mount with the same guards as `persistState`
 * and persist on every change; `activeKey` is controlled-only (never
 * persisted).
 */
export interface IrisTableViewConfig {
  /** Storage adapter (`getItem`/`setItem`; defaults to `localStorage`).
   * `false` keeps views in-memory only — no reads, no writes. */
  storage?: Pick<Storage, 'getItem' | 'setItem'> | false
  /** Storage key. Default `'iris-table-views'`. */
  key?: string
  /** Label formatter for a view name (rendered in the toolbar select). */
  label?: (name: string) => string
  /** Controlled active view key; omit for uncontrolled (internal state). */
  activeKey?: string | null
}

/** Default storage key for named views (batch AH, iris 独有 naming). */
export const IRIS_TABLE_VIEWS_DEFAULT_KEY = 'iris-table-views'

/**
 * Sentinel select value that opens the save input — never a real view name.
 * Views named like the sentinel are dropped at read time and refused at save
 * time (they would otherwise render unselectable in the toolbar).
 */
export const IRIS_TABLE_VIEWS_SAVE_ITEM = '__iris-save-view'

/**
 * Read + parse + sanitize the stored view list. Any failure → null (missing
 * key / corrupt JSON / non-array value are all ignored); entries that are not
 * `{ name: string, snapshot: object }` are dropped individually. The window
 * guard makes the parse a strict no-op during SSR — the load happens in the
 * first render's lazy ref (guarded, idempotent), effects never run
 * server-side.
 */
function readViews(config: IrisTableViewConfig | undefined): IrisTableNamedView[] | null {
  if (!config || config.storage === false) return null
  if (typeof window === 'undefined') return null
  const store = config.storage ?? defaultStorage()
  if (!store) return null
  let raw: string | null
  try {
    raw = store.getItem(config.key ?? IRIS_TABLE_VIEWS_DEFAULT_KEY)
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
  if (!Array.isArray(parsed)) return null
  const out: IrisTableNamedView[] = []
  for (const entry of parsed) {
    if (typeof entry !== 'object' || entry === null || Array.isArray(entry)) continue
    const name = (entry as Record<string, unknown>).name
    const snapshot = (entry as Record<string, unknown>).snapshot
    if (typeof name !== 'string' || name.trim() === '') continue
    if (name === IRIS_TABLE_VIEWS_SAVE_ITEM) continue
    if (typeof snapshot !== 'object' || snapshot === null || Array.isArray(snapshot)) continue
    out.push({ name, snapshot: snapshot as IrisTablePersistedState })
  }
  return out
}

export interface UseTableViewsOptions {
  /** The `views` prop (undefined → views fully off). */
  config: IrisTableViewConfig | undefined
  /** Current state pieces — the SAME collector memo `persistState` uses
   * (captured at save time under the typed name). */
  snapshot: IrisTablePersistedState | null
  /** Apply one stored snapshot through the table's change callbacks. */
  applySnapshot: (snapshot: IrisTablePersistedState) => void
  /** Controlled active key (`views.activeKey`); undefined → internal state. */
  activeKey?: string | null
  /** Fired whenever the active view changes (select / save / delete-of-active). */
  onActiveViewChange?: (key: string | null) => void
}

/**
 * Batch AH — the `views` coordinator. Like `usePersistState` it is a pure
 * LOADS/SAVES coordinator: the view list is the only state it owns; the
 * snapshots themselves are parent-owned through the change callbacks
 * (`applySnapshot` replays them). `activeKey` is controlled-only — never
 * persisted (the baseline fiat: a view list survives remounts, the *current*
 * selection is a session concern).
 */
export function useTableViews(options: UseTableViewsOptions): {
  views: IrisTableNamedView[]
  activeKey: string | null
  saveView: (name: string) => void
  selectView: (key: string) => void
  deleteView: (key: string) => void
} {
  const { config, snapshot, applySnapshot, activeKey, onActiveViewChange } = options

  // Parse ONCE (same lazy-ref guard as usePersistState — StrictMode-safe and
  // SSR-safe; the parse is a guarded idempotent read).
  const parsedRef = React.useRef<IrisTableNamedView[] | null>(null)
  const parsedLoadedRef = React.useRef(false)
  if (!parsedLoadedRef.current) {
    parsedLoadedRef.current = true
    parsedRef.current = readViews(config)
  }
  const [views, setViews] = React.useState<IrisTableNamedView[]>(parsedRef.current ?? [])
  const [internalKey, setInternalKey] = React.useState<string | null>(null)
  const activeKeyRef = React.useRef(activeKey)
  activeKeyRef.current = activeKey
  const displayKey = activeKey !== undefined ? activeKey : internalKey

  // Latest-closure refs: the callbacks are re-created on every render but must
  // never act on a stale list / snapshot / callback.
  const viewsRef = React.useRef(views)
  viewsRef.current = views
  const snapshotRef = React.useRef(snapshot)
  snapshotRef.current = snapshot
  const applyRef = React.useRef(applySnapshot)
  applyRef.current = applySnapshot
  const onActiveViewChangeRef = React.useRef(onActiveViewChange)
  onActiveViewChangeRef.current = onActiveViewChange

  // Persist the whole list (atomic, lossless). `storage: false` keeps the
  // list in memory only; quota/security errors never break the table.
  const persistViews = React.useCallback(
    (next: IrisTableNamedView[]): void => {
      setViews(next)
      if (!config || config.storage === false) return
      const store = config.storage ?? defaultStorage()
      if (!store) return
      try {
        store.setItem(config.key ?? IRIS_TABLE_VIEWS_DEFAULT_KEY, JSON.stringify(next))
      } catch {
        // Quota / security errors must never break the table.
      }
    },
    [config],
  )

  /** Save the CURRENT state pieces under a name (duplicate names upsert,
   * per the baseline fiat) and select the saved view. */
  const saveView = React.useCallback(
    (name: string): void => {
      const trimmed = name.trim()
      if (!trimmed || trimmed === IRIS_TABLE_VIEWS_SAVE_ITEM) return
      const entry: IrisTableNamedView = { name: trimmed, snapshot: snapshotRef.current ?? {} }
      const prev = viewsRef.current
      const existing = prev.findIndex((v) => v.name === trimmed)
      const next =
        existing >= 0 ? prev.map((v, i) => (i === existing ? entry : v)) : [...prev, entry]
      persistViews(next)
      setInternalKey(trimmed)
      onActiveViewChangeRef.current?.(trimmed)
    },
    [persistViews],
  )

  /** Apply a stored view's snapshot through the callbacks + select it. */
  const selectView = React.useCallback((key: string): void => {
    const view = viewsRef.current.find((v) => v.name === key)
    if (!view) return
    applyRef.current(view.snapshot)
    setInternalKey(key)
    onActiveViewChangeRef.current?.(key)
  }, [])

  /** Remove a view (+ persist); deleting the active view clears the key. */
  const deleteView = React.useCallback(
    (key: string): void => {
      persistViews(viewsRef.current.filter((v) => v.name !== key))
      if (displayKey === key) {
        setInternalKey(null)
        onActiveViewChangeRef.current?.(null)
      }
    },
    [persistViews, displayKey],
  )

  return { views, activeKey: displayKey, saveView, selectView, deleteView }
}
