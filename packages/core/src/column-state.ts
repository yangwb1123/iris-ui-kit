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
}

export interface ColumnStateSnapshot {
  order: string[]
  widths: Record<string, number>
  hidden: Set<string>
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
  /** Columns currently visible, in current order. */
  visibleColumns(): ColumnDef[]
  /** All columns including hidden, in current order. */
  allColumns(): ColumnDef[]
  /** Reset to the initial column configuration. */
  reset(): void
  /** Subscribe to state changes. */
  subscribe(fn: (snap: ColumnStateSnapshot) => void): () => void
}

export function createColumnState(columns: ColumnDef[]): ColumnStateManager {
  const initialOrder = columns.map((c) => c.key)
  const initialWidths: Record<string, number> = {}
  for (const c of columns) {
    if (c.width !== undefined) initialWidths[c.key] = c.width
  }
  const initialHidden = columns.filter((c) => c.hidden).map((c) => c.key)

  const store = createStore({
    order: [...initialOrder],
    widths: { ...initialWidths },
    hidden: new Set(initialHidden),
  })

  const byKey = new Map(columns.map((c) => [c.key, c]))

  const api: ColumnStateManager = {
    order: () => store.getState().order,
    setOrder: (keys) => {
      store.setState((s) => ({ ...s, order: keys }))
    },
    reorder: (from, to) => {
      const order = [...store.getState().order]
      const [moved] = order.splice(from, 1)
      order.splice(to, 0, moved)
      store.setState((s) => ({ ...s, order }))
    },
    getWidth: (key) => store.getState().widths[key] ?? byKey.get(key)?.width,
    setWidth: (key, width) => {
      store.setState((s) => ({ ...s, widths: { ...s.widths, [key]: width } }))
    },
    isVisible: (key) => !store.getState().hidden.has(key),
    toggleColumn: (key) => {
      store.setState((s) => {
        const next = new Set(s.hidden)
        if (next.has(key)) next.delete(key)
        else next.add(key)
        return { ...s, hidden: next }
      })
    },
    hide: (key) => {
      store.setState((s) => {
        const next = new Set(s.hidden)
        next.add(key)
        return { ...s, hidden: next }
      })
    },
    show: (key) => {
      store.setState((s) => {
        const next = new Set(s.hidden)
        next.delete(key)
        return { ...s, hidden: next }
      })
    },
    visibleColumns: () => {
      const { order, hidden } = store.getState()
      return order
        .filter((k) => !hidden.has(k))
        .map((k) => byKey.get(k)!)
        .filter(Boolean)
    },
    allColumns: () => {
      return store
        .getState()
        .order.map((k) => byKey.get(k)!)
        .filter(Boolean)
    },
    reset: () => {
      store.setState({
        order: [...initialOrder],
        widths: { ...initialWidths },
        hidden: new Set(initialHidden),
      })
    },
    subscribe: (fn) =>
      store.subscribe((s) => fn({ order: s.order, widths: s.widths, hidden: new Set(s.hidden) })),
  }

  return api
}
