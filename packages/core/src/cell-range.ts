import { createStore, type Store } from './store'

/** A zero-based (row, col) address in a table grid. */
export interface CellAddress {
  row: number
  col: number
}

/** A rectangular range defined by an anchor (where selection started) and an active cell. */
export interface CellRange {
  start: CellAddress
  end: CellAddress
}

export interface CellRangeState {
  /** The cell where the selection started (stays fixed while extending). */
  anchor: CellAddress | null
  /** The cell that moves as the user drags / uses Shift+Arrow. */
  active: CellAddress | null
}

export interface CellRangeController {
  /** Read the raw store state (`anchor` + `active`). */
  getState(): CellRangeState
  subscribe(cb: (s: CellRangeState) => void): () => void
  /** Begin a new selection at (row, col) — sets both anchor and active. */
  startRange(row: number, col: number): void
  /** Move the active cell to (row, col), keeping the anchor fixed. */
  extendRange(row: number, col: number): void
  /** Clear the selection. */
  clearRange(): void
  /**
   * Returns true when (row, col) falls within the normalized rectangle from
   * anchor to active (inclusive on both axes, handles inverted direction).
   */
  isInRange(row: number, col: number): boolean
  /**
   * Returns the normalized range (top-left → bottom-right) or null when
   * no selection is active.
   */
  getRange(): CellRange | null
}

/**
 * Framework-agnostic cell-range selection controller. Powers the "Excel-style"
 * rectangular cell-range in IrisTable across React / Vue / Solid / Svelte.
 *
 * State lives in a `createStore` instance so any framework adapter can bridge
 * it with its own reactivity (useSyncExternalStore / shallowRef / createSignal /
 * toStore).
 */
export function createCellRange(): CellRangeController {
  const store: Store<CellRangeState> = createStore<CellRangeState>({
    anchor: null,
    active: null,
  })

  const getRange = (): CellRange | null => {
    const { anchor, active } = store.getState()
    if (!anchor || !active) return null
    return {
      start: {
        row: Math.min(anchor.row, active.row),
        col: Math.min(anchor.col, active.col),
      },
      end: {
        row: Math.max(anchor.row, active.row),
        col: Math.max(anchor.col, active.col),
      },
    }
  }

  return {
    getState: () => store.getState(),
    subscribe: (cb) => store.subscribe(cb),

    startRange(row, col) {
      store.setState({ anchor: { row, col }, active: { row, col } })
    },

    extendRange(row, col) {
      const { anchor } = store.getState()
      if (!anchor) {
        // Extend without an anchor: treat target as both anchor and active.
        store.setState({ anchor: { row, col }, active: { row, col } })
        return
      }
      store.setState((prev) => ({ ...prev, active: { row, col } }))
    },

    clearRange() {
      store.setState({ anchor: null, active: null })
    },

    isInRange(row, col) {
      const range = getRange()
      if (!range) return false
      return (
        row >= range.start.row &&
        row <= range.end.row &&
        col >= range.start.col &&
        col <= range.end.col
      )
    },

    getRange,
  }
}
