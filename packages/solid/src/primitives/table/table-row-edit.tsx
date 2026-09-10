import { createMemo, createSignal, onCleanup, type Accessor } from 'solid-js'
import {
  createTableRowEditModel,
  type TableRowEditCommit,
  type TableRowEditSession as CoreTableRowEditSession,
  type TableRowEditState,
} from '@iris-ui-kit/core'
import { isEditableColumn } from './utils'
import type { IrisTableColumn } from './types'

type TableRowKey = string | number

/** The session projection consumed by the existing Solid row editor JSX. */
export interface RowCellSession<Row extends Record<string, unknown>> {
  readonly col: IrisTableColumn<Row>
  readonly rowIndex: number
  readonly draft: Accessor<string>
  readonly error: Accessor<string | null>
  readonly setDraft: (value: string) => void
}

export interface TableRowEditController<Row extends Record<string, unknown>> {
  /** Reactive projection of Core's row-session map. */
  readonly rowSessions: Accessor<ReadonlyMap<string, RowCellSession<Row>>>
  /** The existing `{ k, idx }` row-mode active shape. */
  readonly rowEditing: Accessor<{ k: TableRowKey; idx: number } | null>
  /** DOM-only focus targets for the row's editors. */
  readonly rowEditorRefs: Map<string, HTMLInputElement>
  setDraft(id: string, value: string): void
  beginRowEdit(row: Row, rowIndex: number, focusColKey?: string): void
  switchRowEdit(row: Row, rowIndex: number, focusColKey?: string): void
  handleRowCellClick(
    row: Row,
    column: IrisTableColumn<Row>,
    rowIndex: number,
    key: TableRowKey,
  ): void
  commitRowSession(session: RowCellSession<Row>, row: Row, key: TableRowKey): boolean
  cancelRowEdit(expected?: RowCellSession<Row>): void
  focusRowEditor(columnKey: string): void
}

export interface TableRowEditOptions<Row extends Record<string, unknown>> {
  getColumns: () => readonly IrisTableColumn<Row>[]
  getRows: () => Row[]
  /** Resolve the latest source row, including rows replaced by a prior commit. */
  findRow?: (key: TableRowKey) => Row | undefined
  getRowId: (row: Row, rowIndex: number) => TableRowKey
  getCellValue: (row: Row, column: IrisTableColumn<Row>) => unknown
  /** The table's existing row write/emit/undo transaction throat. */
  writeCellValue: (commit: TableRowEditCommit<Row, IrisTableColumn<Row>, TableRowKey>) => void
}

interface ProjectedRowCellSession<Row extends Record<string, unknown>> extends RowCellSession<Row> {
  sync(session: CoreTableRowEditSession<Row, IrisTableColumn<Row>, TableRowKey>): void
}

/**
 * Solid's thin bridge over the framework-free row-edit model. Core owns row
 * sessions, validation, commit lifetimes, switching, and stale async results;
 * this module only projects snapshots into Solid accessors and handles the
 * editor refs/focus and component disposal.
 */
export function createTableRowEditController<Row extends Record<string, unknown>>(
  options: TableRowEditOptions<Row>,
): TableRowEditController<Row> {
  const model = createTableRowEditModel<Row, IrisTableColumn<Row>, TableRowKey>({
    getColumns: options.getColumns,
    getRows: options.getRows,
    isEditable: isEditableColumn,
    getColumnKey: (column) => column.key,
    getRowKey: options.getRowId,
    getCellValue: options.getCellValue,
    getInitialDraft: (value) => String(value ?? ''),
    getEditRules: (column) => column.editRules,
    // Number parsing remains an editor policy in the adapter, matching the
    // existing row-mode behavior and invalid-input fallback.
    coerce: (draft, row, column) =>
      column.editor === 'number'
        ? draft === '' || Number.isNaN(Number(draft))
          ? options.getCellValue(row, column)
          : Number(draft)
        : draft,
    validate: (value, row, column) => column.validate?.(value, row) ?? null,
    findRow: options.findRow,
    onCommit: (commit) => options.writeCellValue(commit),
  })

  const [activeState, setActiveState] = createSignal<{
    key: TableRowKey
    index: number
  } | null>(null)
  const [rowSessions, setRowSessions] = createSignal<ReadonlyMap<string, RowCellSession<Row>>>(
    new Map(),
  )
  const projectedSessions = new Map<string, ProjectedRowCellSession<Row>>()
  const rowEditorRefs = new Map<string, HTMLInputElement>()
  let disposed = false

  const rowEditing = createMemo<{ k: TableRowKey; idx: number } | null>(() => {
    const active = activeState()
    return active ? { k: active.key, idx: active.index } : null
  })

  const syncSession = (
    id: string,
    session: CoreTableRowEditSession<Row, IrisTableColumn<Row>, TableRowKey>,
  ): ProjectedRowCellSession<Row> => {
    const existing = projectedSessions.get(id)
    if (existing && existing.col === session.column && existing.rowIndex === session.rowIndex) {
      existing.sync(session)
      return existing
    }

    const [draft, setDraftValue] = createSignal(String(session.draft ?? ''))
    const [error, setErrorValue] = createSignal<string | null>(session.error)
    const projected: ProjectedRowCellSession<Row> = {
      col: session.column,
      rowIndex: session.rowIndex,
      draft,
      error,
      setDraft: (value) => {
        model.setDraft(id, value)
      },
      sync: (next) => {
        setDraftValue(String(next.draft ?? ''))
        setErrorValue(next.error)
      },
    }
    projectedSessions.set(id, projected)
    return projected
  }

  const sync = (state: TableRowEditState<Row, IrisTableColumn<Row>, TableRowKey>): void => {
    setActiveState(state.active ? { ...state.active } : null)
    const next = new Map<string, RowCellSession<Row>>()
    for (const [id, session] of state.sessions) next.set(id, syncSession(id, session))
    for (const id of projectedSessions.keys()) {
      if (!next.has(id)) projectedSessions.delete(id)
    }
    setRowSessions(next)
  }

  const unsubscribe = model.store.subscribe(sync)
  sync(model.getState())

  const resetProjectedSessions = (): void => {
    projectedSessions.clear()
    // The model notification has already projected the replacement using the
    // old objects; immediately project again after clearing so stale callbacks
    // see the new session identity before the next render.
    sync(model.getState())
  }

  const focusRowEditor = (columnKey: string): void => {
    queueMicrotask(() => {
      if (!disposed) rowEditorRefs.get(columnKey)?.focus()
    })
  }

  const editableColumns = (): IrisTableColumn<Row>[] =>
    options.getColumns().filter(isEditableColumn)
  const focusColumn = (columns: readonly IrisTableColumn<Row>[], requested?: string): void => {
    const target =
      requested && columns.some((column) => column.key === requested) ? requested : columns[0]?.key
    if (target !== undefined) focusRowEditor(target)
  }

  const beginRowEdit = (row: Row, rowIndex: number, focusColKey?: string): void => {
    const columns = editableColumns()
    if (!model.begin(row, rowIndex)) return
    resetProjectedSessions()
    focusColumn(columns, focusColKey)
  }

  const switchRowEdit = (row: Row, rowIndex: number, focusColKey?: string): void => {
    const columns = editableColumns()
    if (!model.switch(row, rowIndex)) return
    resetProjectedSessions()
    focusColumn(columns, focusColKey)
  }

  const handleRowCellClick = (
    row: Row,
    column: IrisTableColumn<Row>,
    rowIndex: number,
    key: TableRowKey,
  ): void => {
    if (Object.is(rowEditing()?.k, key)) {
      if (!isEditableColumn(column)) return
      const id = `${String(key)}::${column.key}`
      const wasOpen = model.session(id) !== undefined
      if (model.openCell(row, column, rowIndex) && !wasOpen) focusRowEditor(column.key)
      return
    }
    switchRowEdit(row, rowIndex, column.key)
  }

  const commitRowSession = (session: RowCellSession<Row>, _row: Row, key: TableRowKey): boolean => {
    const id = `${String(key)}::${session.col.key}`
    // A blur/keydown callback from an old DOM node must not address a newly
    // reopened Core session with the same cell id.
    if (rowSessions().get(id) !== session) return true
    return model.commit(id)
  }

  onCleanup(() => {
    disposed = true
    unsubscribe()
    model.dispose()
    projectedSessions.clear()
    rowEditorRefs.clear()
  })

  return {
    rowSessions,
    rowEditing,
    rowEditorRefs,
    setDraft: (id, value) => {
      model.setDraft(id, value)
    },
    beginRowEdit,
    switchRowEdit,
    handleRowCellClick,
    commitRowSession,
    cancelRowEdit: (expected) => {
      if (expected && ![...rowSessions().values()].includes(expected)) return
      model.cancelAll()
    },
    focusRowEditor,
  }
}
