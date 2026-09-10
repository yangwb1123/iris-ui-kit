import type { EditRules, EditValidationSource } from './edit-rules'
import type { ReadonlyStore } from './store'

export type TableRowEditKey = string | number

export interface TableRowEditActive<Key extends TableRowEditKey = TableRowEditKey> {
  readonly key: Key
  readonly index: number
}

export interface TableRowEditSession<Row, Column, Key extends TableRowEditKey = TableRowEditKey> {
  /** The source row captured when this row session was opened. */
  readonly row: Row
  readonly rowKey: Key
  readonly column: Column
  /** The visible/source index supplied when the row session was opened. */
  readonly rowIndex: number
  /** The adapter-owned draft representation. */
  readonly draft: unknown
  readonly error: string | null
  /** Incremented whenever the draft or a commit attempt changes. */
  readonly epoch: number
  /** True while an async validation attempt is unresolved. */
  readonly pending: boolean
}

export interface TableRowEditState<Row, Column, Key extends TableRowEditKey = TableRowEditKey> {
  readonly active: TableRowEditActive<Key> | null
  readonly sessions: ReadonlyMap<string, TableRowEditSession<Row, Column, Key>>
}

export interface TableRowEditCommit<Row, Column, Key extends TableRowEditKey = TableRowEditKey> {
  readonly rowKey: Key
  /** The exact source row resolved for this commit; never a cloned row. */
  readonly row: Row
  readonly column: Column
  /** The index captured when the row session was opened. */
  readonly rowIndex: number
  readonly oldValue: unknown
  readonly newValue: unknown
}

/**
 * Result notification for one row-cell commit attempt. The model emits this
 * only after the complete validation chain (editRules + custom validation)
 * settles. Cancelled or stale attempts are intentionally silent.
 */
export interface TableRowEditValidation<
  Row,
  Column,
  Key extends TableRowEditKey = TableRowEditKey,
> {
  readonly rowKey: Key
  readonly row: Row
  readonly column: Column
  readonly rowIndex: number
  readonly valid: boolean
  readonly commit: true
  /** Which validation channel produced this outcome. */
  readonly source: EditValidationSource
}

export interface TableRowEditOptions<Row, Column, Key extends TableRowEditKey = TableRowEditKey> {
  /** Current columns, including any adapter-specific projection. */
  readonly getColumns: () => readonly Column[]
  /** Current rows used both for key fallback and row-scoped editRules. */
  readonly getRows: () => Row[]
  /** Select the columns that can participate in row mode. The optional row
   * argument lets adapters re-check row-scoped editability at commit time. */
  readonly isEditable: (column: Column, row?: Row) => boolean
  readonly getColumnKey: (column: Column) => string
  readonly getRowKey: (row: Row, rowIndex: number) => Key
  readonly getCellValue: (row: Row, column: Column) => unknown
  /** Convert a source value to the adapter's editor draft representation. */
  readonly getInitialDraft?: (value: unknown, row: Row, column: Column) => unknown
  readonly getEditRules?: (column: Column) => EditRules<Row> | undefined
  /** Convert an editor draft to the value written to the source row. */
  readonly coerce?: (draft: unknown, row: Row, column: Column) => unknown
  /** Optional legacy/custom column validation after coercion. */
  readonly validate?: (
    value: unknown,
    row: Row,
    column: Column,
  ) => string | null | undefined | Promise<string | null | undefined>
  /** Resolve the latest canonical row before validating/committing. */
  readonly findRow?: (key: Key) => Row | undefined
  /** Override the adapter's cell-session id format when necessary. */
  readonly getSessionId?: (key: Key, column: Column) => string
  /** Notify adapters of a completed, current validation attempt. */
  readonly onValidation?: (validation: TableRowEditValidation<Row, Column, Key>) => void
  readonly onCommit?: (commit: TableRowEditCommit<Row, Column, Key>) => void
}

export interface TableRowEditModel<Row, Column, Key extends TableRowEditKey = TableRowEditKey> {
  readonly store: ReadonlyStore<TableRowEditState<Row, Column, Key>>
  getState(): TableRowEditState<Row, Column, Key>
  getActive(): TableRowEditActive<Key> | null
  session(id: string): TableRowEditSession<Row, Column, Key> | undefined
  /** Open every editable column for a row. */
  begin(row: Row, rowIndex: number): boolean
  /** Commit the current row's open cells, then open the requested row. */
  switch(row: Row, rowIndex: number): boolean
  /** Open one additional editable cell in the active row. */
  openCell(row: Row, column: Column, rowIndex: number): boolean
  /** Replace one cell's draft and invalidate its pending validation. */
  setDraft(id: string, draft: unknown): boolean
  /** Validate and commit one open cell. Async validation returns true while pending. */
  commit(id: string): boolean
  /** Attempt every currently open cell; sync failures keep the row open. */
  commitAll(): boolean
  /** Cancel every open cell and invalidate all pending validation results. */
  cancelAll(): void
  /** Idempotently dispose the model and drop all late async results. */
  dispose(): void
}
