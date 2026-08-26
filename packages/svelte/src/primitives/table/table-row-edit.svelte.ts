import { validateEditRulesAsync } from '@iris-ui-kit/core'
import { isEditableColumn } from './tableUtils'
import type { IrisTableCellEditEvent, IrisTableColumn } from './types'

export interface TableRowEditSession {
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
  ) => boolean
  tab: (
    id: string,
    row: Record<string, unknown>,
    column: IrisTableColumn,
    rowIndex: number,
    key: string | number,
    direction: 1 | -1,
  ) => void
  cancel: () => void
}

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
  const pending = new Set<TableRowEditSession>()

  const focus = (columnKey: string): void => {
    queueMicrotask(() => inputRefs.get(columnKey)?.focus())
  }

  const makeSession = (
    row: Record<string, unknown>,
    column: IrisTableColumn,
    rowIndex: number,
  ): TableRowEditSession => ({
    column,
    rowIndex,
    draft: String(options.getCellValue(row, column) ?? ''),
    error: null,
    epoch: 0,
    cancelled: false,
    committed: false,
  })

  const commit = (
    id: string,
    row: Record<string, unknown>,
    column: IrisTableColumn,
    rowIndex: number,
    key: string | number,
  ): boolean => {
    const session = sessions.get(id)
    if (!session) return true
    const liveRow =
      options.findRow?.(key) ??
      options.getRows().find((candidate, index) => options.getRowId(candidate, index) === key) ??
      row
    const oldValue = options.getCellValue(liveRow, column)
    const draft = session.draft
    const newValue =
      column.editor === 'number'
        ? draft === '' || Number.isNaN(Number(draft))
          ? oldValue
          : Number(draft)
        : draft
    const finish = (): void => {
      if (session.cancelled || session.committed) return
      session.committed = true
      pending.delete(session)
      if (sessions.get(id) !== session) {
        if (newValue !== oldValue) {
          options.onCommit?.({ row: liveRow, column, oldValue, newValue, rowIndex })
        }
        return
      }
      const next = new Map(sessions)
      next.delete(id)
      sessions = next
      if (next.size === 0) active = null
      if (newValue !== oldValue) {
        options.onCommit?.({ row: liveRow, column, oldValue, newValue, rowIndex })
      }
    }
    if (column.editRules?.length) {
      const epoch = ++session.epoch
      pending.add(session)
      const context = { rows: options.getRows(), columnKey: column.key }
      void validateEditRulesAsync(column.editRules, draft, liveRow, false, context).then(
        (result) => {
          if (session.cancelled || session.epoch !== epoch || session.committed) return
          if (!result.valid) {
            pending.delete(session)
            if (sessions.get(id) !== session) return
            const next = new Map(sessions)
            next.set(id, { ...session, error: result.messages[0] ?? null })
            sessions = next
            return
          }
          finish()
        },
      )
      return true
    }
    if (column.validate) {
      const error = column.validate(newValue, liveRow)
      if (error) {
        const next = new Map(sessions)
        next.set(id, { ...session, error })
        sessions = next
        return false
      }
    }
    session.epoch++
    finish()
    return true
  }

  const begin = (row: Record<string, unknown>, rowIndex: number, focusColumn?: string): void => {
    const columns = options.getColumns().filter(isEditableColumn)
    if (!columns.length) return
    const key = options.getRowId(row, rowIndex)
    const next = new Map<string, TableRowEditSession>()
    for (const column of columns)
      next.set(`${key}::${column.key}`, makeSession(row, column, rowIndex))
    sessions = next
    active = { key, index: rowIndex }
    const target =
      focusColumn && columns.some((column) => column.key === focusColumn)
        ? focusColumn
        : columns[0]!.key
    focus(target)
  }

  const switchTo = (row: Record<string, unknown>, rowIndex: number, focusColumn?: string): void => {
    const current = active
    if (current) {
      for (const session of sessions.values()) {
        const id = `${current.key}::${session.column.key}`
        if (!commit(id, row, session.column, session.rowIndex, current.key)) return
      }
    }
    begin(row, rowIndex, focusColumn)
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
      if (!sessions.has(id)) {
        const next = new Map(sessions)
        next.set(id, makeSession(row, column, rowIndex))
        sessions = next
        focus(column.key)
      }
      return
    }
    switchTo(row, rowIndex, column.key)
  }

  const tab = (
    id: string,
    row: Record<string, unknown>,
    column: IrisTableColumn,
    rowIndex: number,
    key: string | number,
    direction: 1 | -1,
  ): void => {
    if (!commit(id, row, column, rowIndex, key)) return
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
      const session = sessions.get(id)
      if (!session) return
      session.epoch++
      const next = new Map(sessions)
      next.set(id, { ...session, draft: value, error: null })
      sessions = next
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
    cancel: () => {
      for (const session of sessions.values()) session.epoch++
      for (const session of pending) {
        session.epoch++
        session.cancelled = true
      }
      pending.clear()
      sessions = new Map()
      active = null
    },
  }
}
