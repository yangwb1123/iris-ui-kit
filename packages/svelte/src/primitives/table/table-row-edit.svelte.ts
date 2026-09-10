import {
  createTableRowEditModel,
  type TableRowEditSession as CoreTableRowEditSession,
  type TableRowEditState,
} from '@iris-ui-kit/core'
import { isEditableColumn } from './tableUtils'
import type { IrisTableCellEditEvent, IrisTableColumn } from './types'

export interface TableRowEditSession {
  /** Stable logical-session identity; draft/error projections may be replaced. */
  readonly identity: object
  readonly column: IrisTableColumn
  readonly rowIndex: number
  draft: string
  error: string | null
  epoch: number
  cancelled: boolean
  committed: boolean
}

export interface TableRowEditController {
  readonly active: { key: string | number; index: number } | null
  session: (id: string) => TableRowEditSession | undefined
  setDraft: (id: string, value: string) => void
  registerInput: (key: string, node: HTMLInputElement | null) => void
  begin: (row: Record<string, unknown>, rowIndex: number, focusColumn?: string) => void
  switchTo: (row: Record<string, unknown>, rowIndex: number, focusColumn?: string) => void
  handleCellClick: (
    row: Record<string, unknown>,
    column: IrisTableColumn,
    rowIndex: number,
    key: string | number,
  ) => void
  commit: (
    id: string,
    row: Record<string, unknown>,
    column: IrisTableColumn,
    rowIndex: number,
    key: string | number,
    expected?: TableRowEditSession,
    expectedIdentity?: object,
  ) => boolean
  tab: (
    id: string,
    row: Record<string, unknown>,
    column: IrisTableColumn,
    rowIndex: number,
    key: string | number,
    direction: 1 | -1,
    expected?: TableRowEditSession,
    expectedIdentity?: object,
  ) => void
  cancel: (expected?: TableRowEditSession, expectedIdentity?: object) => void
}

/**
 * Svelte's thin bridge over the framework-free row-edit session model. The
 * public controller remains deliberately shaped for IrisTable's existing DOM
 * and focus plumbing; only the reactive snapshot and editor policy live here.
 */
export function createTableRowEditController(options: {
  getColumns: () => IrisTableColumn[]
  getRows: () => Array<Record<string, unknown>>
  /** Resolve the latest row from the shared Core rows source (including tree children). */
  findRow?: (key: string | number) => Record<string, unknown> | undefined
  getRowId: (row: Record<string, unknown>, index: number) => string | number
  getCellValue: (row: Record<string, unknown>, column: IrisTableColumn) => unknown
  onCommit?: (event: IrisTableCellEditEvent) => void
}): TableRowEditController {
  let active = $state<{ key: string | number; index: number } | null>(null)
  let sessions = $state<Map<string, TableRowEditSession>>(new Map())
  const inputRefs = new Map<string, HTMLInputElement>()

  const focus = (columnKey: string): void => {
    queueMicrotask(() => inputRefs.get(columnKey)?.focus())
  }

  const editableColumns = (): IrisTableColumn[] => options.getColumns().filter(isEditableColumn)

  const focusColumn = (columns: IrisTableColumn[], requested?: string): void => {
    const target =
      requested && columns.some((column) => column.key === requested) ? requested : columns[0]?.key
    if (target !== undefined) focus(target)
  }

  const sessionIdentities = new Map<string, object>()
  const projectSession = (
    id: string,
    session: CoreTableRowEditSession<Record<string, unknown>, IrisTableColumn, string | number>,
  ): TableRowEditSession => ({
    identity: sessionIdentities.get(id) ?? {},
    column: session.column,
    rowIndex: session.rowIndex,
    draft: String(session.draft ?? ''),
    error: session.error,
    epoch: session.epoch,
    // Core drops cancelled/committed sessions from its snapshot. These fields
    // stay in the adapter projection for the existing controller contract.
    cancelled: false,
    committed: false,
  })

  const model = createTableRowEditModel<Record<string, unknown>, IrisTableColumn, string | number>({
    getColumns: options.getColumns,
    getRows: options.getRows,
    isEditable: isEditableColumn,
    getColumnKey: (column) => column.key,
    getRowKey: options.getRowId,
    getCellValue: options.getCellValue,
    getInitialDraft: (value) => String(value ?? ''),
    getEditRules: (column) => column.editRules,
    // Number parsing is an editor policy, not a Core row-session concern.
    coerce: (draft, row, column) =>
      column.editor === 'number'
        ? draft === '' || Number.isNaN(Number(draft))
          ? options.getCellValue(row, column)
          : Number(draft)
        : draft,
    validate: (value, row, column) => column.validate?.(value, row) ?? null,
    findRow: options.findRow,
    onCommit: ({ row, column, oldValue, newValue, rowIndex }) => {
      options.onCommit?.({ row, column, oldValue, newValue, rowIndex })
    },
  })

  const sync = (
    state: TableRowEditState<Record<string, unknown>, IrisTableColumn, string | number>,
  ): void => {
    active = state.active ? { ...state.active } : null
    const next = new Map<string, TableRowEditSession>()
    for (const [id, session] of state.sessions) {
      if (!sessionIdentities.has(id)) sessionIdentities.set(id, {})
      next.set(id, projectSession(id, session))
    }
    for (const id of sessionIdentities.keys()) {
      if (!next.has(id)) sessionIdentities.delete(id)
    }
    sessions = next
  }

  const unsubscribe = model.store.subscribe(sync)
  sync(model.store.getState())

  const resetProjectedSessions = (): void => {
    sessionIdentities.clear()
    // Re-project synchronously because Core's store subscriber has already
    // populated `sessions` with the old projection for reused ids.
    sync(model.getState())
  }

  // A row editor can outlive an async validator by a component unmount. The
  // Core dispose guard invalidates that validator before its result can write.
  $effect(() => {
    return () => {
      unsubscribe()
      model.dispose()
      sessionIdentities.clear()
      inputRefs.clear()
    }
  })

  const begin = (row: Record<string, unknown>, rowIndex: number, requested?: string): void => {
    const columns = editableColumns()
    if (!model.begin(row, rowIndex)) return
    resetProjectedSessions()
    focusColumn(columns, requested)
  }

  const switchTo = (row: Record<string, unknown>, rowIndex: number, requested?: string): void => {
    const columns = editableColumns()
    if (!model.switch(row, rowIndex)) return
    resetProjectedSessions()
    focusColumn(columns, requested)
  }

  const handleCellClick = (
    row: Record<string, unknown>,
    column: IrisTableColumn,
    rowIndex: number,
    key: string | number,
  ): void => {
    if (active?.key === key) {
      if (!isEditableColumn(column)) return
      const id = `${key}::${column.key}`
      const wasOpen = model.session(id) !== undefined
      if (model.openCell(row, column, rowIndex) && !wasOpen) focus(column.key)
      return
    }
    switchTo(row, rowIndex, column.key)
  }

  const commit = (
    id: string,
    _row: Record<string, unknown>,
    _column: IrisTableColumn,
    _rowIndex: number,
    _key: string | number,
    expected?: TableRowEditSession,
    expectedIdentity?: object,
  ): boolean => {
    // A stale blur/keydown callback must not commit a reopened same-id
    // session. Returning true preserves the harmless closed-cell contract.
    if (expectedIdentity !== undefined && sessions.get(id)?.identity !== expectedIdentity) {
      return true
    }
    if (expected && sessions.get(id)?.identity !== expected.identity) return true
    return model.commit(id)
  }

  const tab = (
    id: string,
    _row: Record<string, unknown>,
    column: IrisTableColumn,
    _rowIndex: number,
    _key: string | number,
    direction: 1 | -1,
    expected?: TableRowEditSession,
    expectedIdentity?: object,
  ): void => {
    if (expectedIdentity !== undefined && sessions.get(id)?.identity !== expectedIdentity) {
      return
    }
    if (expected && sessions.get(id)?.identity !== expected.identity) return
    if (!model.commit(id)) return
    if (model.session(id)?.error) return
    const columns = options.getColumns()
    const start = columns.indexOf(column)
    for (let index = start + direction; index >= 0 && index < columns.length; index += direction) {
      if (isEditableColumn(columns[index]!)) {
        focus(columns[index]!.key)
        return
      }
    }
  }

  return {
    get active() {
      return active
    },
    session: (id) => sessions.get(id),
    setDraft: (id, value) => {
      model.setDraft(id, value)
    },
    registerInput: (key, node) => {
      if (node) inputRefs.set(key, node)
      else inputRefs.delete(key)
    },
    begin,
    switchTo,
    handleCellClick,
    commit,
    tab,
    cancel: (expected, expectedIdentity) => {
      if (
        (expected && ![...sessions.values()].includes(expected)) ||
        (expectedIdentity &&
          ![...sessions.values()].some((session) => session.identity === expectedIdentity))
      ) {
        return
      }
      model.cancelAll()
    },
  }
}
