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
  /** Read an owned state snapshot (`anchor` + `active`). */
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

function cloneAddress(address: CellAddress | null): CellAddress | null {
  return address ? { row: address.row, col: address.col } : null
}

function cloneState(state: CellRangeState): CellRangeState {
  return { anchor: cloneAddress(state.anchor), active: cloneAddress(state.active) }
}

function hasExactKeys(value: object, keys: readonly string[]): boolean {
  const ownKeys = Reflect.ownKeys(value)
  return (
    ownKeys.length === keys.length &&
    keys.every((key) => Object.prototype.hasOwnProperty.call(value, key))
  )
}

function isAddressSnapshot(value: unknown, canonical: CellAddress | null): boolean {
  if (canonical === null) return value === null
  if (value === null || typeof value !== 'object') return false
  const address = value as Partial<CellAddress>
  return (
    hasExactKeys(address, ['row', 'col']) &&
    Object.is(address.row, canonical.row) &&
    Object.is(address.col, canonical.col)
  )
}

function isStateSnapshot(value: unknown, canonical: CellRangeState): boolean {
  if (value === null || typeof value !== 'object') return false
  const state = value as Partial<CellRangeState>
  return (
    hasExactKeys(state, ['anchor', 'active']) &&
    isAddressSnapshot(state.anchor, canonical.anchor) &&
    isAddressSnapshot(state.active, canonical.active)
  )
}

function normalizeRange(anchor: CellAddress | null, active: CellAddress | null): CellRange | null {
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

function containsCell(range: CellRange | null, row: number, col: number): boolean {
  if (!range) return false
  return (
    row >= range.start.row && row <= range.end.row && col >= range.start.col && col <= range.end.col
  )
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

  // Keep a stable public snapshot for external-store consumers, but never let
  // a consumer-owned object become the canonical store state. The integrity
  // check also repairs a published snapshot that a consumer mutated between
  // reads without requiring a range operation.
  let snapshot: CellRangeState | undefined
  let snapshotSource: CellRangeState | undefined
  const getState = (): CellRangeState => {
    const canonical = store.getState()
    if (snapshotSource !== canonical || !isStateSnapshot(snapshot, canonical)) {
      snapshotSource = canonical
      snapshot = cloneState(canonical)
    }
    return snapshot!
  }

  const getRange = (): CellRange | null => {
    const { anchor, active } = store.getState()
    return normalizeRange(anchor, active)
  }

  return {
    getState,
    // Each subscriber gets a separate delivery. In particular, mutating one
    // callback's snapshot cannot affect another callback or the canonical
    // state held by the private store.
    subscribe: (cb) => store.subscribe((state) => cb(cloneState(state))),

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
      return containsCell(getRange(), row, col)
    },

    getRange,
  }
}
