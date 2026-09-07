import * as React from 'react'
import {
  createTableRowEditModel,
  type CellEdit,
  type GridEditingKey,
  type TableRowEditCommit,
  type TableRowEditModel,
  type TableRowEditState,
  type TableRowEditValidation,
} from '@iris-ui-kit/core'
import { useStore } from '../../useStore'
import type { IrisTableColumn } from './types'
import {
  createProjectedSession,
  sessionId,
  type ProjectedSession,
} from './table-row-edit-projection'

type TableRowKey = GridEditingKey

type RowCellEdit = CellEdit<TableRowKey>
type CoreState<Row extends Record<string, unknown>> = TableRowEditState<
  Row,
  IrisTableColumn<Row>,
  TableRowKey
>
type CoreCommit<Row extends Record<string, unknown>> = TableRowEditCommit<
  Row,
  IrisTableColumn<Row>,
  TableRowKey
>
type CoreValidation<Row extends Record<string, unknown>> = TableRowEditValidation<
  Row,
  IrisTableColumn<Row>,
  TableRowKey
>

export interface TableRowEditBridgeOptions<Row extends Record<string, unknown>> {
  getColumns: () => readonly IrisTableColumn<Row>[]
  getRows: () => Row[]
  /** Resolve the latest source row, including tree children. */
  findRow?: (key: TableRowKey) => Row | undefined
  getRowKey: (row: Row, rowIndex: number) => TableRowKey
  getCellValue: (row: Row, column: IrisTableColumn<Row>) => unknown
  /** The table's single row-mode editability throat. */
  isEditable: (row: Row, column: IrisTableColumn<Row>) => boolean
  coerce: (draft: unknown, row: Row, column: IrisTableColumn<Row>) => unknown
  validate?: (
    value: unknown,
    row: Row,
    column: IrisTableColumn<Row>,
  ) => string | null | undefined | Promise<string | null | undefined>
  /** Called once for each column opened by a row session. */
  onOpen?: (column: IrisTableColumn<Row>) => void
  onValidation?: (validation: CoreValidation<Row>) => void
  /** The existing immutable rows/update/onCellEdit throat. */
  onCommit: (commit: CoreCommit<Row>) => void
}

export interface TableRowEditBridge<Row extends Record<string, unknown>> {
  readonly model: TableRowEditModel<Row, IrisTableColumn<Row>, TableRowKey>
  readonly state: CoreState<Row>
  /** Existing row-mode render contract: one CellEdit per open column. */
  readonly rowSessions: ReadonlyMap<string, RowCellEdit>
  /** Existing `{ k, idx }` row-mode shape. */
  readonly rowEditing: { k: TableRowKey; idx: number } | null
  /** React-only focus token; no editing state is stored here. */
  readonly rowFocus: { colKey: string; seq: number }
  /** React-only DOM ref registry for row editor elements. */
  readonly rowEditorRefs: React.MutableRefObject<
    Map<string, HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  >
  registerRowEditorRef: (
    columnKey: string,
  ) => (el: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement | null) => void
  focusRowEditor: (columnKey: string) => void
  beginRowEdit: (row: Row, rowIndex: number, focusColumn?: string) => void
  switchRowEdit: (row: Row, rowIndex: number, focusColumn?: string) => void
  handleRowModeCellClick: (
    row: Row,
    column: IrisTableColumn<Row>,
    rowIndex: number,
    key: TableRowKey,
  ) => void
  commitRowSession: (id: string, expected?: RowCellEdit) => boolean
  moveRowEditOnTab: (
    e: React.KeyboardEvent,
    direction: 1 | -1,
    column: IrisTableColumn<Row>,
    row: Row,
    expected?: RowCellEdit,
  ) => void
  cancelRowEdit: (expected?: RowCellEdit) => void
}

/**
 * React's thin bridge over the framework-free row-edit model. Core owns the
 * row session map, validation, coercion boundary, switching and stale async
 * lifetimes. This hook owns only CellEdit projections plus React focus refs,
 * tokens, callback mirrors and disposal.
 */
export function useTableRowEdit<Row extends Record<string, unknown>>(
  options: TableRowEditBridgeOptions<Row>,
): TableRowEditBridge<Row> {
  const latest = React.useRef(options)
  latest.current = options
  const projectionsRef = React.useRef(new Map<string, ProjectedSession>())
  const modelRef = React.useRef<TableRowEditModel<Row, IrisTableColumn<Row>, TableRowKey> | null>(
    null,
  )

  if (modelRef.current === null) {
    modelRef.current = createTableRowEditModel<Row, IrisTableColumn<Row>, TableRowKey>({
      getColumns: () => latest.current.getColumns(),
      getRows: () => latest.current.getRows(),
      isEditable: (column, row) => row !== undefined && latest.current.isEditable(row, column),
      getColumnKey: (column) => column.key,
      getRowKey: (row, rowIndex) => latest.current.getRowKey(row, rowIndex),
      getCellValue: (row, column) => latest.current.getCellValue(row, column),
      getInitialDraft: (value) => String(value ?? ''),
      getEditRules: (column) => column.editRules,
      coerce: (draft, row, column) => latest.current.coerce(draft, row, column),
      validate: (value, row, column) => latest.current.validate?.(value, row, column) ?? null,
      findRow: (key) => latest.current.findRow?.(key),
      getSessionId: (key, column) => sessionId(key, column.key),
      onValidation: (validation) => latest.current.onValidation?.(validation),
      onCommit: (commit) => {
        const projection = projectionsRef.current.get(sessionId(commit.rowKey, commit.column.key))
        projection?.markValidated(commit.newValue)
        latest.current.onCommit(commit)
      },
    })
  }
  const model = modelRef.current
  if (model === null) throw new Error('row edit model was not created')

  const state = useStore(model.store)
  const startProjectedEdit = React.useCallback(
    (rowKey: TableRowKey, columnKey: string, initialDraft: unknown): void => {
      const columns = latest.current.getColumns()
      const column = columns.find((candidate) => candidate.key === columnKey)
      if (!column) return
      const rows = latest.current.getRows()
      const row = latest.current.findRow
        ? latest.current.findRow(rowKey)
        : rows.find((candidate, index) =>
            Object.is(latest.current.getRowKey(candidate, index), rowKey),
          )
      if (!row) return
      const rowIndex = rows.findIndex((candidate, index) =>
        Object.is(latest.current.getRowKey(candidate, index), rowKey),
      )
      const previousActive = model.getActive()
      if (!model.openCell(row, column, rowIndex >= 0 ? rowIndex : 0)) return
      // openCell() may switch rows. A same-id replacement of the Core session
      // must also replace the adapter projection, otherwise an old DOM
      // callback can pass the identity guard and commit the new session.
      if (previousActive === null || !Object.is(previousActive.key, rowKey)) {
        projectionsRef.current.clear()
      }
      model.setDraft(sessionId(rowKey, columnKey), initialDraft)
    },
    [model],
  )
  const rowEditing = React.useMemo(
    () => (state.active ? { k: state.active.key, idx: state.active.index } : null),
    [state.active],
  )
  const rowSessions = React.useMemo<ReadonlyMap<string, RowCellEdit>>(() => {
    const next = new Map<string, RowCellEdit>()
    for (const id of state.sessions.keys()) {
      let projection = projectionsRef.current.get(id)
      if (!projection) {
        projection = createProjectedSession(id, model, (column) => column.key, startProjectedEdit)
        projectionsRef.current.set(id, projection)
      }
      next.set(id, projection.edit)
    }
    for (const id of projectionsRef.current.keys()) {
      if (!state.sessions.has(id)) projectionsRef.current.delete(id)
    }
    return next
  }, [model, startProjectedEdit, state])

  const [rowFocus, setRowFocus] = React.useState<{ colKey: string; seq: number }>({
    colKey: '',
    seq: 0,
  })
  const rowEditorRefs = React.useRef<
    Map<string, HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  >(new Map())
  const rowEditorRefCallbacks = React.useRef(
    new Map<
      string,
      (el: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement | null) => void
    >(),
  )
  const focusRowEditor = React.useCallback((columnKey: string): void => {
    setRowFocus((previous) => ({ colKey: columnKey, seq: previous.seq + 1 }))
  }, [])
  const registerRowEditorRef = React.useCallback((columnKey: string) => {
    const existing = rowEditorRefCallbacks.current.get(columnKey)
    if (existing) return existing
    const callback = (
      element: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement | null,
    ): void => {
      if (element) rowEditorRefs.current.set(columnKey, element)
      else rowEditorRefs.current.delete(columnKey)
    }
    rowEditorRefCallbacks.current.set(columnKey, callback)
    return callback
  }, [])

  const editableColumnsFor = (row: Row): IrisTableColumn<Row>[] =>
    latest.current.getColumns().filter((column) => latest.current.isEditable(row, column))
  const notifyOpened = (columns: readonly IrisTableColumn<Row>[]): void => {
    for (const column of columns) latest.current.onOpen?.(column)
  }
  const focusColumn = (columns: readonly IrisTableColumn<Row>[], requested?: string): void => {
    const target =
      requested && columns.some((column) => column.key === requested) ? requested : columns[0]?.key
    if (target !== undefined) focusRowEditor(target)
  }

  const beginRowEdit = React.useCallback(
    (row: Row, rowIndex: number, requested?: string): void => {
      const columns = editableColumnsFor(row)
      const opened = model.begin(row, rowIndex)
      if (!opened) return
      projectionsRef.current.clear()
      rowEditorRefs.current.clear()
      notifyOpened(columns)
      focusColumn(columns, requested)
    },
    [model, focusRowEditor],
  )
  const switchRowEdit = React.useCallback(
    (row: Row, rowIndex: number, requested?: string): void => {
      const columns = editableColumnsFor(row)
      const opened = model.switch(row, rowIndex)
      if (!opened) return
      projectionsRef.current.clear()
      rowEditorRefs.current.clear()
      notifyOpened(columns)
      focusColumn(columns, requested)
    },
    [model, focusRowEditor],
  )
  const handleRowModeCellClick = React.useCallback(
    (row: Row, column: IrisTableColumn<Row>, rowIndex: number, key: TableRowKey): void => {
      const active = model.getActive()
      if (active !== null && Object.is(active.key, key)) {
        if (!latest.current.isEditable(row, column)) return
        const id = sessionId(key, column.key)
        const wasOpen = model.session(id) !== undefined
        const opened = model.openCell(row, column, rowIndex)
        if (opened && !wasOpen) {
          latest.current.onOpen?.(column)
          focusRowEditor(column.key)
        }
        return
      }
      switchRowEdit(row, rowIndex, column.key)
    },
    [model, focusRowEditor, switchRowEdit],
  )
  const commitRowSession = React.useCallback(
    (id: string, expected?: RowCellEdit): boolean => {
      // A stale blur from an editor that already unmounted must not commit a
      // freshly reopened session with the same cell id. The projection
      // identity is stable across draft updates and replaced on a new Core
      // session, so stale DOM callbacks remain harmless.
      if (expected && projectionsRef.current.get(id)?.edit !== expected) return true
      return model.commit(id)
    },
    [model],
  )
  const moveRowEditOnTab = React.useCallback(
    (
      event: React.KeyboardEvent,
      direction: 1 | -1,
      column: IrisTableColumn<Row>,
      row: Row,
      expected?: RowCellEdit,
    ): void => {
      if (event.key !== 'Tab') return
      event.preventDefault()
      const active = model.getActive()
      const id = active === null ? '' : sessionId(active.key, column.key)
      if (expected && projectionsRef.current.get(id)?.edit !== expected) return
      if (active !== null && model.session(id) !== undefined) {
        model.commit(id)
        const afterCommit = model.session(id)
        if (afterCommit !== undefined && afterCommit.error !== null) return
      }
      const columns = latest.current.getColumns()
      const start = columns.findIndex((candidate) => candidate.key === column.key)
      for (
        let index = start + direction;
        index >= 0 && index < columns.length;
        index += direction
      ) {
        const next = columns[index]!
        if (!latest.current.isEditable(row, next)) continue
        focusRowEditor(next.key)
        return
      }
    },
    [model, focusRowEditor],
  )
  const cancelRowEdit = React.useCallback(
    (expected?: RowCellEdit): void => {
      if (
        expected &&
        ![...projectionsRef.current.values()].some((projection) => projection.edit === expected)
      ) {
        return
      }
      model.cancelAll()
    },
    [model],
  )

  React.useEffect(() => {
    return () => {
      model.dispose()
      rowEditorRefs.current.clear()
      rowEditorRefCallbacks.current.clear()
      projectionsRef.current.clear()
    }
  }, [model])

  return {
    model,
    state,
    rowSessions,
    rowEditing,
    rowFocus,
    rowEditorRefs,
    registerRowEditorRef,
    focusRowEditor,
    beginRowEdit,
    switchRowEdit,
    handleRowModeCellClick,
    commitRowSession,
    moveRowEditOnTab,
    cancelRowEdit,
  }
}
