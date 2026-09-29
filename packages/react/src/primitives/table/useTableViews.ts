import * as React from 'react'
import {
  readTableViews,
  TABLE_VIEWS_DEFAULT_KEY,
  TABLE_VIEWS_SAVE_ITEM,
  writeTableViews,
} from '@iris-ui-kit/core'
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
export const IRIS_TABLE_VIEWS_DEFAULT_KEY = TABLE_VIEWS_DEFAULT_KEY

/**
 * Sentinel select value that opens the save input — never a real view name.
 * Views named like the sentinel are dropped at read time and refused at save
 * time (they would otherwise render unselectable in the toolbar).
 */
export const IRIS_TABLE_VIEWS_SAVE_ITEM = TABLE_VIEWS_SAVE_ITEM

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

  // Keep the first render on the default empty list. The storage read belongs
  // to the mount effect so server markup and the client's hydration render use
  // the same view list; the ref also keeps StrictMode from reading twice.
  const configRef = React.useRef(config)
  configRef.current = config
  const viewsLoadedRef = React.useRef(false)
  const [views, setViews] = React.useState<IrisTableNamedView[]>([])
  React.useEffect(() => {
    if (viewsLoadedRef.current) return
    viewsLoadedRef.current = true
    setViews(readTableViews<IrisTablePersistedState>(configRef.current))
  }, [])
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
      writeTableViews(config, next)
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
