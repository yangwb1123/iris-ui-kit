/**
 * createColumnState — standalone column state manager.
 *
 * Manages column order, visibility, and width for any data grid or table,
 * independent of the pro-table store. Useful for custom table implementations
 * that need column customization (show/hide, reorder, resize) without pulling
 * in the full pro-table machinery.
 *
 * Usage:
 * ```ts
 * const cs = createColumnState([
 *   { key: 'name', title: 'Name', width: 200 },
 *   { key: 'email', title: 'Email', width: 300 },
 * ])
 * cs.visibleColumns()           // [{ key: 'name', ... }, { key: 'email', ... }]
 * cs.toggleColumn('email')
 * cs.visibleColumns()           // [{ key: 'name', ... }]
 * cs.resetColumns()
 * cs.visibleColumns()           // [{ key: 'name', ... }, { key: 'email', ... }]
 * ```
 */
import { createStore } from './store'

export interface ColumnDef {
  key: string
  title: string
  width?: number
  minWidth?: number
  hidden?: boolean
  /** Pin (freeze) the column to a side. */
  pinned?: 'left' | 'right'
}

export interface ColumnStateSnapshot {
  order: string[]
  widths: Record<string, number>
  hidden: Set<string>
  pinned: Record<string, 'left' | 'right'>
}

export interface ColumnStateManager {
  /** Current column order (keys). */
  order(): string[]
  /** Set column order. */
  setOrder(keys: string[]): void
  /** Move a column from `fromIndex` to `toIndex`. */
  reorder(fromIndex: number, toIndex: number): void
  /** Get width for a column, falling back to its definition `width`. */
  getWidth(key: string): number | undefined
  /** Set (resize) a column width. */
  setWidth(key: string, width: number): void
  /** Check if a column is visible. */
  isVisible(key: string): boolean
  /** Toggle a column's visibility. */
  toggleColumn(key: string): void
  /** Hide a column. */
  hide(key: string): void
  /** Show a column. */
  show(key: string): void
  /** Get a column's pinned side, or null. */
  getPinned(key: string): 'left' | 'right' | null
  /** Pin a column to a side; pass null to unpin. */
  setPinned(key: string, side: 'left' | 'right' | null): void
  /** Columns currently visible, in current order. */
  visibleColumns(): ColumnDef[]
  /** All columns including hidden, in current order. */
  allColumns(): ColumnDef[]
  /** Reset to the initial column configuration. */
  reset(): void
  /** Subscribe to state changes. */
  subscribe(fn: (snap: ColumnStateSnapshot) => void): () => void
}

interface ColumnStoreState {
  order: string[]
  widths: Record<string, number>
  hidden: Set<string>
  pinned: Record<string, 'left' | 'right'>
}

interface InitialColumnState {
  state: ColumnStoreState
  byKey: Map<string, ColumnDef>
}

function createInitialColumnState(columns: ColumnDef[]): InitialColumnState {
  const order = columns.map((column) => column.key)
  const widths: Record<string, number> = {}
  const hidden = new Set<string>()
  const pinned: Record<string, 'left' | 'right'> = {}
  for (const column of columns) {
    if (column.width !== undefined) widths[column.key] = column.width
    if (column.hidden) hidden.add(column.key)
    if (column.pinned) pinned[column.key] = column.pinned
  }
  return {
    state: { order, widths, hidden, pinned },
    byKey: new Map(columns.map((column) => [column.key, column])),
  }
}

function copyColumnState(state: ColumnStoreState): ColumnStoreState {
  return {
    order: [...state.order],
    widths: { ...state.widths },
    hidden: new Set(state.hidden),
    pinned: { ...state.pinned },
  }
}

function reorderColumn(
  store: ReturnType<typeof createStore<ColumnStoreState>>,
  from: number,
  to: number,
): void {
  const order = [...store.getState().order]
  const [moved] = order.splice(from, 1)
  order.splice(to, 0, moved)
  store.setState((state) => ({ ...state, order }))
}

function setColumnVisibility(
  store: ReturnType<typeof createStore<ColumnStoreState>>,
  key: string,
  visible: boolean,
): void {
  store.setState((state) => {
    const hidden = new Set(state.hidden)
    if (visible) hidden.delete(key)
    else hidden.add(key)
    return { ...state, hidden }
  })
}

function setColumnPinned(
  store: ReturnType<typeof createStore<ColumnStoreState>>,
  key: string,
  side: 'left' | 'right' | null,
): void {
  store.setState((state) => {
    const pinned = { ...state.pinned }
    if (side) pinned[key] = side
    else delete pinned[key]
    return { ...state, pinned }
  })
}

function columnsInOrder(
  store: ReturnType<typeof createStore<ColumnStoreState>>,
  byKey: Map<string, ColumnDef>,
  visibleOnly: boolean,
): ColumnDef[] {
  const { order, hidden } = store.getState()
  return order
    .filter((key) => !visibleOnly || !hidden.has(key))
    .map((key) => byKey.get(key)!)
    .filter(Boolean)
}

export function createColumnState(columns: ColumnDef[]): ColumnStateManager {
  const initial = createInitialColumnState(columns)
  const store = createStore<ColumnStoreState>(copyColumnState(initial.state))
  const { byKey } = initial

  const api: ColumnStateManager = {
    order: () => store.getState().order,
    setOrder: (keys) => store.setState((state) => ({ ...state, order: keys })),
    reorder: (from, to) => reorderColumn(store, from, to),
    getWidth: (key) => store.getState().widths[key] ?? byKey.get(key)?.width,
    setWidth: (key, width) =>
      store.setState((state) => ({ ...state, widths: { ...state.widths, [key]: width } })),
    isVisible: (key) => !store.getState().hidden.has(key),
    toggleColumn: (key) => setColumnVisibility(store, key, !api.isVisible(key)),
    hide: (key) => setColumnVisibility(store, key, false),
    show: (key) => setColumnVisibility(store, key, true),
    getPinned: (key) => store.getState().pinned[key] ?? null,
    setPinned: (key, side) => setColumnPinned(store, key, side),
    visibleColumns: () => columnsInOrder(store, byKey, true),
    allColumns: () => columnsInOrder(store, byKey, false),
    reset: () => {
      store.setState(copyColumnState(initial.state))
    },
    subscribe: (fn) =>
      store.subscribe((s) =>
        fn({
          order: s.order,
          widths: s.widths,
          hidden: new Set(s.hidden),
          pinned: { ...s.pinned },
        }),
      ),
  }

  return api
}
