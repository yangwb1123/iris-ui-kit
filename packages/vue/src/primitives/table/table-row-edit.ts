import { computed, nextTick, onBeforeUnmount, shallowRef, type ComputedRef } from 'vue'
import { createTableRowEditModel, type TableRowEditCommit } from '@iris-ui-kit/core'
import { cellId, isEditableColumn } from './table-helpers'
import type { IrisTableColumn } from './types'

type TableRow = Record<string, unknown>
type TableColumn = IrisTableColumn<TableRow>
type TableRowKey = string | number

/** The small session projection consumed by the existing Vue editor renderer. */
export interface TableRowEditSession {
  draft: string
  error: string | null
}

export interface TableRowEditController {
  /** Reactive projection of the Core session map for Vue rendering. */
  readonly rowSessions: ComputedRef<ReadonlyMap<string, TableRowEditSession>>
  /** Reactive projection retaining the table's existing `{ k, idx }` shape. */
  readonly rowEditing: ComputedRef<{ k: TableRowKey; idx: number } | null>
  /** DOM-only focus targets; the renderer registers its inputs here. */
  readonly rowEditorRefs: Map<string, HTMLInputElement | null>
  setDraft(id: string, draft: string): void
  beginRowEdit(row: TableRow, rowIndex: number, focusColKey?: string): void
  switchRowEdit(row: TableRow, rowIndex: number, focusColKey?: string): void
  handleRowModeCellClick(
    row: TableRow,
    column: TableColumn,
    rowIndex: number,
    key: TableRowKey,
  ): void
  commitRowSession(
    key: TableRowKey,
    column: TableColumn,
    rowIndex: number,
    editCellId: string,
    expected?: TableRowEditSession,
  ): boolean
  moveRowEditOnTab(
    key: TableRowKey,
    column: TableColumn,
    rowIndex: number,
    editCellId: string,
    expected: TableRowEditSession,
    direction: 1 | -1,
  ): void
  cancelRowEdit(expected?: TableRowEditSession): void
}

export interface TableRowEditOptions {
  getColumns: () => readonly TableColumn[]
  getRows: () => TableRow[]
  /** Resolve the latest source row, including rows replaced by a prior commit. */
  findRow?: (key: TableRowKey) => TableRow | undefined
  getRowId: (row: TableRow, rowIndex: number) => TableRowKey
  getCellValue: (row: TableRow, column: TableColumn) => unknown
  /** The table's existing row write/emit/undo throat. */
  writeCellValue: (commit: TableRowEditCommit<TableRow, TableColumn, TableRowKey>) => void
}

/**
 * Vue's thin bridge over the framework-free row-session model. Core owns
 * drafts, validation, epochs, switching, and commits; this module only
 * projects the session shape, schedules editor focus, and disposes the model.
 */
export function createTableRowEditController(options: TableRowEditOptions): TableRowEditController {
  const model = createTableRowEditModel<TableRow, TableColumn, TableRowKey>({
    getColumns: options.getColumns,
    getRows: options.getRows,
    isEditable: isEditableColumn,
    getColumnKey: (column) => column.key,
    getRowKey: options.getRowId,
    getCellValue: options.getCellValue,
    getInitialDraft: (value) => String(value ?? ''),
    getEditRules: (column) => column.editRules,
    // Number parsing remains an editor policy in the adapter, matching the
    // existing Vue row-mode behavior and its invalid-input fallback.
    coerce: (draft, row, column) =>
      column.editor === 'number'
        ? draft === '' || Number.isNaN(Number(draft))
          ? options.getCellValue(row, column)
          : Number(draft)
        : draft,
    validate: (value, row, column) => column.validate?.(value, row) ?? null,
    findRow: options.findRow,
    onCommit: (commit) => {
      options.writeCellValue(commit)
    },
  })

  const state = shallowRef(model.getState())
  const projectedSessions = new Map<string, TableRowEditSession>()
  const unsubscribe = model.store.subscribe((next) => {
    state.value = next
    // Delete projections synchronously, before a same-tick close/reopen can
    // reuse the old object identity for the new Core session.
    for (const id of projectedSessions.keys()) {
      if (!next.sessions.has(id)) projectedSessions.delete(id)
    }
  })
  const rowEditorRefs = new Map<string, HTMLInputElement | null>()
  let disposed = false

  const rowEditing = computed<{ k: TableRowKey; idx: number } | null>(() => {
    const active = state.value.active
    return active ? { k: active.key, idx: active.index } : null
  })
  const rowSessions = computed<ReadonlyMap<string, TableRowEditSession>>(() => {
    const projected = new Map<string, TableRowEditSession>()
    for (const [id, session] of state.value.sessions) {
      const existing = projectedSessions.get(id)
      if (existing) {
        existing.draft = String(session.draft ?? '')
        existing.error = session.error
        projected.set(id, existing)
      } else {
        const next: TableRowEditSession = {
          draft: String(session.draft ?? ''),
          error: session.error,
        }
        projectedSessions.set(id, next)
        projected.set(id, next)
      }
    }
    return projected
  })

  const focus = (columnKey: string): void => {
    void nextTick(() => {
      if (!disposed) rowEditorRefs.get(columnKey)?.focus()
    })
  }
  const editableColumns = (): TableColumn[] => options.getColumns().filter(isEditableColumn)
  const focusColumn = (columns: readonly TableColumn[], requested?: string): void => {
    const target =
      requested && columns.some((column) => column.key === requested) ? requested : columns[0]?.key
    if (target !== undefined) focus(target)
  }

  const beginRowEdit = (row: TableRow, rowIndex: number, focusColKey?: string): void => {
    const columns = editableColumns()
    if (!model.begin(row, rowIndex)) return
    // Core replaces the session object even when the row/cell id is reused.
    // Do the same for the projection so stale DOM callbacks cannot address the
    // newly opened session.
    projectedSessions.clear()
    focusColumn(columns, focusColKey)
  }

  const switchRowEdit = (row: TableRow, rowIndex: number, focusColKey?: string): void => {
    const columns = editableColumns()
    if (!model.switch(row, rowIndex)) return
    projectedSessions.clear()
    focusColumn(columns, focusColKey)
  }

  const handleRowModeCellClick = (
    row: TableRow,
    column: TableColumn,
    rowIndex: number,
    key: TableRowKey,
  ): void => {
    if (rowEditing.value?.k === key) {
      if (!isEditableColumn(column)) return
      const id = cellId(key, column.key)
      const wasOpen = model.session(id) !== undefined
      if (model.openCell(row, column, rowIndex) && !wasOpen) focus(column.key)
      return
    }
    switchRowEdit(row, rowIndex, column.key)
  }

  const commitRowSession = (
    _key: TableRowKey,
    _column: TableColumn,
    _rowIndex: number,
    editCellId: string,
    expected?: TableRowEditSession,
  ): boolean => {
    if (expected && rowSessions.value.get(editCellId) !== expected) return true
    return model.commit(editCellId)
  }

  const moveRowEditOnTab = (
    key: TableRowKey,
    column: TableColumn,
    rowIndex: number,
    editCellId: string,
    expected: TableRowEditSession,
    direction: 1 | -1,
  ): void => {
    if (rowSessions.value.get(editCellId) !== expected) return
    if (!commitRowSession(key, column, rowIndex, editCellId, expected)) return
    const current = model.session(editCellId)
    if (current?.error) return
    const columns = options.getColumns()
    const start = columns.findIndex((candidate) => candidate.key === column.key)
    for (let index = start + direction; index >= 0 && index < columns.length; index += direction) {
      const next = columns[index]!
      if (!isEditableColumn(next)) continue
      focus(next.key)
      return
    }
  }

  const controller: TableRowEditController = {
    rowSessions,
    rowEditing,
    rowEditorRefs,
    setDraft: (id, draft) => {
      model.setDraft(id, draft)
    },
    beginRowEdit,
    switchRowEdit,
    handleRowModeCellClick,
    commitRowSession,
    moveRowEditOnTab,
    cancelRowEdit: (expected) => {
      if (expected && ![...rowSessions.value.values()].includes(expected)) return
      model.cancelAll()
    },
  }

  onBeforeUnmount(() => {
    disposed = true
    unsubscribe()
    model.dispose()
    projectedSessions.clear()
    rowEditorRefs.clear()
  })

  return controller
}
