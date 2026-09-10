import type {
  TableRowEditKey,
  TableRowEditOptions,
  TableRowEditSession,
} from './table-row-edit-types'

/** Create the immutable adapter-owned session snapshot for one cell. */
export function createTableRowEditSession<Row, Column, Key extends TableRowEditKey>(
  options: TableRowEditOptions<Row, Column, Key>,
  row: Row,
  rowKey: Key,
  column: Column,
  rowIndex: number,
): TableRowEditSession<Row, Column, Key> {
  const value = options.getCellValue(row, column)
  const draft = options.getInitialDraft ? options.getInitialDraft(value, row, column) : value
  return {
    row,
    rowKey,
    column,
    rowIndex,
    draft,
    error: null,
    epoch: 0,
    pending: false,
  }
}
