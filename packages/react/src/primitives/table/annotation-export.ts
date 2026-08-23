import { toCsv } from '@iris-ui-kit/core'
import { cellNoteState } from './cell-helpers'
import type { IrisTableColumn } from './types'

interface AnnotationExportOptions<Row extends Record<string, unknown>> {
  enabled: boolean | undefined
  rows: readonly Row[]
  columns: readonly IrisTableColumn<Row>[]
  rowKeyOf: (row: Row, index: number) => string | number
  annotations: Record<string, string> | undefined
  cellNote: ((row: Row, column: IrisTableColumn<Row>) => string | null) | undefined
}

/** Build the annotated-cell CSV in current body/column order. */
export function buildAnnotationsCsv<Row extends Record<string, unknown>>({
  enabled,
  rows,
  columns,
  rowKeyOf,
  annotations,
  cellNote,
}: AnnotationExportOptions<Row>): string {
  if (!enabled) return ''
  const notes: Array<{ rowKey: string | number; column: string; annotation: string }> = []
  rows.forEach((row, index) => {
    const rowKey = rowKeyOf(row, index)
    for (const column of columns) {
      const { note } = cellNoteState(annotations, cellNote, row, column, rowKey)
      if (note) notes.push({ rowKey, column: column.key, annotation: note })
    }
  })
  if (notes.length === 0) return ''
  return toCsv(notes, [
    { key: 'rowKey', title: 'rowKey' },
    { key: 'column', title: 'column' },
    { key: 'annotation', title: 'annotation' },
  ])
}
