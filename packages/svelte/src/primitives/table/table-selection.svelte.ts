import { computeSelectionFlags } from '@iris-ui-kit/core'

type TableRow = Record<string, unknown>
type TableRowKey = string | number

export interface TableSelectionController {
  readonly allSelected: boolean
  readonly someSelected: boolean
  isSelected: (id: TableRowKey) => boolean
  toggleRow: (id: TableRowKey) => void
  toggleAll: () => void
  removeRows: (keys: TableRowKey[]) => void
}

/** Adapter bridge for selection-derived flags and row-removal cleanup. */
export function createTableSelectionController(options: {
  rowIds: () => TableRowKey[]
  selection: () => TableRowKey[]
  selectable: () => 'none' | 'single' | 'multi'
  rebase: () => void
  selectionModel: {
    toggle: (id: TableRowKey) => void
    toggleAll: (ids: TableRowKey[]) => void
    set: (ids: TableRowKey[]) => void
  }
  gridRows: {
    removeMany: (keys: TableRowKey[]) => readonly TableRowKey[]
    get: () => TableRow[]
  }
  onDataChange?: (rows: TableRow[]) => void
}): TableSelectionController {
  const flags = $derived(computeSelectionFlags(options.rowIds(), options.selection()))

  function isSelected(id: TableRowKey): boolean {
    return options.selection().includes(id)
  }

  function toggleRow(id: TableRowKey): void {
    const mode = options.selectable()
    if (mode === 'single' || mode === 'multi') {
      options.rebase()
      options.selectionModel.toggle(id)
    }
  }

  function toggleAll(): void {
    options.rebase()
    options.selectionModel.toggleAll(options.rowIds())
  }

  function removeRows(keys: TableRowKey[]): void {
    const removedKeys = options.gridRows.removeMany(keys)
    if (removedKeys.length === 0) return
    const rows = options.gridRows.get()
    const current = options.selection()
    const removed = new Set(removedKeys)
    const nextSelection = current.filter((key) => !removed.has(key))
    if (nextSelection.length !== current.length) {
      options.rebase()
      options.selectionModel.set(nextSelection)
    }
    options.onDataChange?.(rows)
  }

  return {
    get allSelected() {
      return flags.allSelected
    },
    get someSelected() {
      return flags.someSelected
    },
    isSelected,
    toggleRow,
    toggleAll,
    removeRows,
  }
}
