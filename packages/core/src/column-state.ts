import { createStore, type Store } from './store'

/**
 * Stateful column-management controller — the resize / pin / reorder / hide
 * state that DEFINES an enterprise data grid, sunk into core so the four adapters
 * (and pro-table / the base Table) share ONE implementation instead of each
 * re-coding drag-reorder and width tracking. It owns the column order and each
 * column's width/min/max/pin/visibility, and derives the display layout: pinned-
 * left columns first, then unpinned, then pinned-right, with cumulative pixel
 * offsets for sticky positioning. Serialization is provided for consumer-owned
 * persistence (the controller never touches storage).
 *
 * Pure A-tier material: the adapter renders `state.visibleColumns` in order and
 * calls `setSize`/`move`/`setPinned`/`setVisible` from its resize-handle and
 * drag-reorder UI. `canResize`/`canReorder` are capability flags the UI reads to
 * decide whether to show a handle — the controller itself stays programmatic.
 */

export type ColumnPin = 'left' | 'right' | null

/** A column definition the controller manages (your real column type extends it). */
export interface ColumnDef {
  key: string
  /** Initial width in px. Falls back to {@link ColumnStateConfig.defaultSize}. */
  size?: number
  minSize?: number
  maxSize?: number
  pinned?: ColumnPin
  /** Visible by default unless `false`. */
  visible?: boolean
  /** May the user resize this column? Default `true`. */
  canResize?: boolean
  /** May the user reorder this column? Default `true`. */
  canReorder?: boolean
}

/** A column with its fully-resolved live state. */
export interface ColumnStateItem {
  key: string
  size: number
  minSize: number
  maxSize: number
  pinned: ColumnPin
  visible: boolean
  canResize: boolean
  canReorder: boolean
}

export interface ColumnStateConfig {
  columns: readonly ColumnDef[]
  /** Width for a column that omits `size`. Default `150`. */
  defaultSize?: number
  /** Min width for a column that omits `minSize`. Default `40`. */
  defaultMinSize?: number
  /** Max width for a column that omits `maxSize`. Default `Infinity`. */
  defaultMaxSize?: number
}

export interface ColumnLayout {
  /** Every column in logical order (incl. hidden), with resolved state. */
  columns: ColumnStateItem[]
  /** Visible columns in DISPLAY order: left-pinned, then unpinned, then right-pinned. */
  visibleColumns: ColumnStateItem[]
  leftPinned: ColumnStateItem[]
  unpinned: ColumnStateItem[]
  rightPinned: ColumnStateItem[]
  /** Cumulative left offset (px) per visible column key, in display order. */
  offsets: Record<string, number>
  /** Total width (px) of the visible columns. */
  totalWidth: number
}

/** Serializable snapshot for consumer-owned persistence. */
export interface ColumnStateSnapshot {
  order: string[]
  sizes: Record<string, number>
  pinned: Record<string, ColumnPin>
  hidden: string[]
}

export interface ColumnStateController {
  store: Store<ColumnLayout>
  getState(): ColumnLayout
  subscribe(listener: (state: ColumnLayout) => void): () => void
  /** Set a column's width, clamped to its [minSize, maxSize]. */
  setSize(key: string, size: number): void
  /** Add `deltaPx` to a column's width (resize-drag), clamped. */
  resizeBy(key: string, deltaPx: number): void
  setPinned(key: string, pinned: ColumnPin): void
  setVisible(key: string, visible: boolean): void
  toggleVisible(key: string): void
  /** Move a column to a new index in the logical order. */
  move(key: string, toIndex: number): void
  /** Move a column to just before `beforeKey` (append if `beforeKey` is null). */
  moveBefore(key: string, beforeKey: string | null): void
  /** Restore all columns to their configured defaults. */
  reset(): void
  serialize(): ColumnStateSnapshot
  /** Apply a snapshot (unknown keys ignored; missing keys keep their defaults). */
  deserialize(snapshot: ColumnStateSnapshot): void
  /** Replace the managed columns, preserving live state for keys that persist. */
  setColumns(columns: readonly ColumnDef[]): void
}

export function createColumnState(config: ColumnStateConfig): ColumnStateController {
  const defaultSize = config.defaultSize ?? 150
  const defaultMinSize = config.defaultMinSize ?? 40
  const defaultMaxSize = config.defaultMaxSize ?? Infinity

  const resolve = (def: ColumnDef): ColumnStateItem => {
    const minSize = def.minSize ?? defaultMinSize
    const maxSize = def.maxSize ?? defaultMaxSize
    const size = Math.max(minSize, Math.min(def.size ?? defaultSize, maxSize))
    return {
      key: def.key,
      size,
      minSize,
      maxSize,
      pinned: def.pinned ?? null,
      visible: def.visible ?? true,
      canResize: def.canResize ?? true,
      canReorder: def.canReorder ?? true,
    }
  }

  let defs: ColumnDef[] = config.columns.map((c) => ({ ...c }))
  let items = new Map<string, ColumnStateItem>(defs.map((d) => [d.key, resolve(d)]))
  let order: string[] = defs.map((d) => d.key)

  const clampSize = (item: ColumnStateItem, size: number): number =>
    Math.max(item.minSize, Math.min(size, item.maxSize))

  const computeLayout = (): ColumnLayout => {
    const ordered = order.map((k) => items.get(k)!).filter(Boolean)
    const left = ordered.filter((c) => c.pinned === 'left')
    const unpinned = ordered.filter((c) => c.pinned === null || c.pinned === undefined)
    const right = ordered.filter((c) => c.pinned === 'right')
    const display = [...left, ...unpinned, ...right]
    const visible = display.filter((c) => c.visible)
    const offsets: Record<string, number> = {}
    let acc = 0
    for (const c of visible) {
      offsets[c.key] = acc
      acc += c.size
    }
    return {
      columns: ordered,
      visibleColumns: visible,
      leftPinned: left.filter((c) => c.visible),
      unpinned: unpinned.filter((c) => c.visible),
      rightPinned: right.filter((c) => c.visible),
      offsets,
      totalWidth: acc,
    }
  }

  const store = createStore<ColumnLayout>(computeLayout())
  const sync = (): void => store.setState(computeLayout())

  const patch = (key: string, next: Partial<ColumnStateItem>): void => {
    const cur = items.get(key)
    if (!cur) return
    items.set(key, { ...cur, ...next })
    sync()
  }

  return {
    store,
    getState: store.getState,
    subscribe: store.subscribe,
    setSize(key, size) {
      const cur = items.get(key)
      if (!cur) return
      const next = clampSize(cur, size)
      if (next === cur.size) return
      patch(key, { size: next })
    },
    resizeBy(key, deltaPx) {
      const cur = items.get(key)
      if (!cur) return
      this.setSize(key, cur.size + deltaPx)
    },
    setPinned(key, pinned) {
      const cur = items.get(key)
      if (!cur || cur.pinned === pinned) return
      patch(key, { pinned })
    },
    setVisible(key, visible) {
      const cur = items.get(key)
      if (!cur || cur.visible === visible) return
      patch(key, { visible })
    },
    toggleVisible(key) {
      const cur = items.get(key)
      if (!cur) return
      patch(key, { visible: !cur.visible })
    },
    move(key, toIndex) {
      const from = order.indexOf(key)
      if (from === -1) return
      const clamped = Math.max(0, Math.min(toIndex, order.length - 1))
      if (from === clamped) return
      const next = order.slice()
      next.splice(from, 1)
      next.splice(clamped, 0, key)
      order = next
      sync()
    },
    moveBefore(key, beforeKey) {
      const from = order.indexOf(key)
      if (from === -1) return
      const next = order.slice()
      next.splice(from, 1)
      const at = beforeKey === null ? next.length : next.indexOf(beforeKey)
      next.splice(at === -1 ? next.length : at, 0, key)
      order = next
      sync()
    },
    reset() {
      items = new Map(defs.map((d) => [d.key, resolve(d)]))
      order = defs.map((d) => d.key)
      sync()
    },
    serialize() {
      const sizes: Record<string, number> = {}
      const pinned: Record<string, ColumnPin> = {}
      const hidden: string[] = []
      for (const k of order) {
        const c = items.get(k)!
        sizes[k] = c.size
        pinned[k] = c.pinned
        if (!c.visible) hidden.push(k)
      }
      return { order: order.slice(), sizes, pinned, hidden }
    },
    deserialize(snapshot) {
      // Order: snapshot keys first (those we still have), then any new columns.
      const known = new Set(items.keys())
      const fromSnap = snapshot.order.filter((k) => known.has(k))
      const rest = order.filter((k) => !fromSnap.includes(k))
      order = [...fromSnap, ...rest]
      const hidden = new Set(snapshot.hidden)
      for (const [k, c] of items) {
        const size = snapshot.sizes[k]
        const pin = snapshot.pinned[k]
        items.set(k, {
          ...c,
          size: size !== undefined ? clampSize(c, size) : c.size,
          pinned: pin !== undefined ? pin : c.pinned,
          visible: !hidden.has(k),
        })
      }
      sync()
    },
    setColumns(columns) {
      const nextDefs = columns.map((c) => ({ ...c }))
      const nextKeys = new Set(nextDefs.map((d) => d.key))
      const nextItems = new Map<string, ColumnStateItem>()
      for (const d of nextDefs) {
        // Preserve live state for a key that persists; resolve fresh otherwise.
        nextItems.set(d.key, items.get(d.key) ?? resolve(d))
      }
      defs = nextDefs
      items = nextItems
      // Keep existing order for surviving keys; append new ones; drop removed.
      const kept = order.filter((k) => nextKeys.has(k))
      const added = nextDefs.map((d) => d.key).filter((k) => !kept.includes(k))
      order = [...kept, ...added]
      sync()
    },
  }
}
