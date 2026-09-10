import type { EditRule } from './edit-rules'
import { createTableRowEditModel, type TableRowEditValidation } from './table-row-edit'

export interface Row {
  id: number
  name: string
  age: number
}

export interface Column {
  key: 'name' | 'age'
  editable?: boolean
  editRules?: EditRule<Row>[]
}

export const columns: Column[] = [
  { key: 'name', editable: true },
  { key: 'age', editable: true },
]

export function makeModel(
  configuredColumns: Column[] = columns,
  configuredRows: Row[] = [
    { id: 1, name: 'Alice', age: 30 },
    { id: 2, name: 'Bob', age: 25 },
  ],
  onValidation?: (validation: TableRowEditValidation<Row, Column, string | number>) => void,
  configuredValidate?: (
    value: unknown,
    row: Row,
    column: Column,
  ) => string | null | undefined | Promise<string | null | undefined>,
) {
  let rows = configuredRows
  const commits: Array<{
    rowKey: string | number
    row: Row
    column: Column
    rowIndex: number
    oldValue: unknown
    newValue: unknown
  }> = []
  const model = createTableRowEditModel<Row, Column>({
    getColumns: () => configuredColumns,
    getRows: () => rows,
    isEditable: (column) => column.editable === true,
    getColumnKey: (column) => column.key,
    getRowKey: (row) => row.id,
    getCellValue: (row, column) => row[column.key],
    getInitialDraft: (value) => String(value ?? ''),
    getEditRules: (column) => column.editRules,
    coerce: (draft, row, column) =>
      column.key === 'age'
        ? draft === '' || Number.isNaN(Number(draft))
          ? row.age
          : Number(draft)
        : draft,
    findRow: (key) => rows.find((row) => row.id === key),
    validate: configuredValidate,
    onValidation,
    onCommit: (commit) => commits.push(commit),
  })
  return {
    model,
    commits,
    rows,
    replaceRows(next: Row[]) {
      rows = next
    },
  }
}

export async function flushAsyncValidation(): Promise<void> {
  await Promise.resolve()
  await Promise.resolve()
  await Promise.resolve()
}
