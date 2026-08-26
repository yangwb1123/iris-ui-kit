import * as React from 'react'
import {
  createGridClipboardFeature,
  type GridClipboardFeatureOptions,
  type GridClipboardModel,
  type GridCore,
} from '@iris-ui-kit/core/grid'
import type {
  GridRowsCommitOptions,
  TableClipboardColumn,
  TableClipboardRange,
  TableCopyFormat,
} from '@iris-ui-kit/core'
import { useGridFeature } from './useGridFeature'

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

function resolveCommitOptions(
  options: GridClipboardFeatureOptions<Record<string, unknown>>['commitOptions'],
): GridRowsCommitOptions {
  if (typeof options === 'function') return options()
  return options ?? {}
}

/** Installs clipboard pure logic while leaving system clipboard I/O in React. */
export function useGridClipboard<Row extends Record<string, unknown> = Record<string, unknown>>(
  core: GridCore<Row>,
  options: UseGridClipboardOptions<Row>,
): UseGridClipboardResult<Row> {
  const latest = React.useRef(options)
  latest.current = options

  const model = useGridFeature<Row, GridClipboardModel>(
    core,
    'clipboard',
    'getClipboardModel',
    () =>
      createGridClipboardFeature<Row>({
        getRows: () => latest.current.getRows?.() ?? core.invoke<Row[]>('getRows'),
        getColumns: () => latest.current.getColumns(),
        resolveValue: (row, column) => {
          const resolve = latest.current.resolveValue
          return resolve ? resolve(row, column) : defaultValue(row, column)
        },
        parseValue: (text, row, column) => {
          const parse = latest.current.parseValue
          return parse ? parse(text, row, column) : text
        },
        setValue: (row, column, value) =>
          latest.current.setValue?.(row, column, value) ?? defaultSetValue(row, column, value),
        isCellEditable: (row, column, rowIndex, columnIndex) =>
          latest.current.isCellEditable?.(row, column, rowIndex, columnIndex) ?? true,
        reconcileRows: (sourceRows, previousRows, rows) =>
          latest.current.reconcileRows?.(sourceRows, previousRows, rows) ?? rows,
        commitOptions: () => resolveCommitOptions(latest.current.commitOptions),
        onCopy: (change) => latest.current.onCopy?.(change),
        onPaste: (change) => latest.current.onPaste?.(change),
      }),
  )

  const serialize = React.useCallback(
    (format?: TableCopyFormat, copyWithFormat?: boolean) =>
      model.serialize(
        format ?? latest.current.copyFormat ?? 'tsv',
        copyWithFormat ?? latest.current.copyWithFormat ?? false,
      ),
    [model],
  )
  const paste = React.useCallback(
    (text: string, range?: TableClipboardRange) => model.paste(text, range),
    [model],
  )

  return { core, model, serialize, paste }
}
