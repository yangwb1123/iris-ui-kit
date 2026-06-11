import { createStore, type Store } from './store'

/**
 * Framework-agnostic inline cell-edit controller — the small state machine that
 * tracks which cell is being edited and runs a commit. Extracted from
 * `@iris-ui/plugin-pro-table` so the base Table, pro-table, and any future data
 * grid share one editing engine instead of re-implementing start/cancel/commit.
 *
 * It owns ONLY the editing state. Resolving the column/row, coercing the value,
 * mutating the dataset, and firing any `onCellEdit` are the caller's job, done
 * in {@link CreateCellEditOptions.onCommit} (which runs before editing clears).
 */

/** The cell currently being edited. */
export interface CellEditTarget {
  rowKey: string
  columnKey: string
}

export interface CellEditState {
  editing: CellEditTarget | null
}

export interface CreateCellEditOptions {
  /**
   * Apply a committed value. Receives the active edit target + the raw value
   * passed to {@link CellEdit.commitEdit}; resolve the column/row, coerce,
   * mutate your data, and fire your own change callback here. Runs synchronously
   * BEFORE the editing state is cleared. Not called when nothing is being edited.
   */
  onCommit?: (target: CellEditTarget, value: unknown) => void
}

export interface CellEdit {
  store: Store<CellEditState>
  /** The cell being edited, or null. */
  getEditing(): CellEditTarget | null
  /** Whether this exact cell is the one being edited. */
  isEditing(rowKey: string, columnKey: string): boolean
  /** Open the editor on a cell (replaces any current edit). */
  startEdit(rowKey: string, columnKey: string): void
  /** Discard the active edit without committing. */
  cancelEdit(): void
  /** Commit the active edit via `onCommit`, then close the editor. No-op when idle. */
  commitEdit(value: unknown): void
}

export function createCellEdit(options: CreateCellEditOptions = {}): CellEdit {
  const store = createStore<CellEditState>({ editing: null })

  return {
    store,
    getEditing: () => store.getState().editing,

    isEditing(rowKey, columnKey) {
      const e = store.getState().editing
      return e !== null && e.rowKey === rowKey && e.columnKey === columnKey
    },

    startEdit(rowKey, columnKey) {
      store.setState({ editing: { rowKey, columnKey } })
    },

    cancelEdit() {
      store.setState({ editing: null })
    },

    commitEdit(value) {
      const target = store.getState().editing
      if (!target) return
      options.onCommit?.(target, value)
      store.setState({ editing: null })
    },
  }
}
