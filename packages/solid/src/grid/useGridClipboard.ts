import {
  createGridClipboardFeature,
  type GridClipboardFeatureOptions,
  type GridClipboardModel,
  type GridCore,
} from '@iris-ui-kit/core/grid'
import type { TableClipboardColumn, TableClipboardRange, TableCopyFormat } from '@iris-ui-kit/core'

export type UseGridClipboardOptions<Row extends Record<string, unknown>> =
  GridClipboardFeatureOptions<Row>

export interface UseGridClipboardResult<Row extends Record<string, unknown>> {
  core: GridCore<Row>
  model: GridClipboardModel
  serialize(format?: TableCopyFormat, copyWithFormat?: boolean): string | null
  paste(text: string, range?: TableClipboardRange): boolean
}

function defaultValue<Row extends Record<string, unknown>>(
  row: Row,
  column: TableClipboardColumn<Row>,
): unknown {
  return row[(column.dataIndex ?? column.key) as keyof Row]
}

function defaultSetValue<Row extends Record<string, unknown>>(
  row: Row,
  column: TableClipboardColumn<Row>,
  value: unknown,
): Row {
  return { ...row, [column.dataIndex ?? column.key]: value }
}

/** Installs clipboard pure logic while leaving system clipboard I/O in Solid. */
export function useGridClipboard<Row extends Record<string, unknown> = Record<string, unknown>>(
  core: GridCore<Row>,
  options: UseGridClipboardOptions<Row>,
): UseGridClipboardResult<Row> {
  const latest = options
  if (!core.hasFeature('clipboard')) {
    core.use(
      createGridClipboardFeature<Row>({
        getRows: () => latest.getRows?.() ?? core.invoke<Row[]>('getRows'),
        getColumns: () => latest.getColumns(),
        rowKeyField: latest.rowKeyField,
        overflowRows: (context) => latest.overflowRows?.(context),
        resolveValue: (row, column) => {
          const resolve = latest.resolveValue
          return resolve ? resolve(row, column) : defaultValue(row, column)
        },
        parseValue: (text, row, column) => {
          const parse = latest.parseValue
          return parse ? parse(text, row, column) : text
        },
        setValue: (row, column, value) =>
          latest.setValue?.(row, column, value) ?? defaultSetValue(row, column, value),
        isCellEditable: (row, column, rowIndex, columnIndex) =>
          latest.isCellEditable?.(row, column, rowIndex, columnIndex) ?? true,
        reconcileRows: (sourceRows, previousRows, rows) =>
          latest.reconcileRows?.(sourceRows, previousRows, rows) ?? rows,
        commitOptions: () => {
          const configured = latest.commitOptions
          return typeof configured === 'function' ? configured() : (configured ?? {})
        },
        onCopy: (change) => latest.onCopy?.(change),
        onPaste: (change) => latest.onPaste?.(change),
      }),
    )
  }
  const model = core.invoke<GridClipboardModel>('getClipboardModel')
  return {
    core,
    model,
    serialize: (format, copyWithFormat) =>
      model.serialize(
        format ?? latest.copyFormat ?? 'tsv',
        copyWithFormat ?? latest.copyWithFormat ?? false,
      ),
    paste: (text, range) => model.paste(text, range),
  }
}
