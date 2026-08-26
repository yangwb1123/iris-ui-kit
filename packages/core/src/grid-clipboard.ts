import type { GridFeature, GridMethod } from './grid'
import type { GridRowsCommitOptions } from './grid-rows'
import {
  resolveTableValue,
  serializeTableRange,
  type TableClipboardColumn,
  type TableClipboardRange,
  type TableClipboardValueResolver,
  type TableCopyFormat,
} from './table-clipboard'

export interface GridClipboardCopyChange {
  readonly type: 'copy'
  readonly format: TableCopyFormat
  readonly range: TableClipboardRange
  readonly rowCount: number
  readonly columnCount: number
}

export interface GridClipboardPasteChange<Row extends Record<string, unknown>> {
  readonly type: 'paste'
  readonly range: TableClipboardRange
  readonly previousRows: readonly Row[]
  readonly rows: readonly Row[]
  readonly changedRows: number
  readonly changedCells: number
}

export type GridClipboardChange<Row extends Record<string, unknown>> =
  GridClipboardCopyChange | GridClipboardPasteChange<Row>

export const GRID_CLIPBOARD_CHANGE_EVENT = 'clipboard:change'

export interface GridClipboardFeatureOptions<Row extends Record<string, unknown>> {
  /** Effective visible/ordered rows; defaults to the standard rows feature snapshot. */
  readonly getRows?: () => readonly Row[]
  /** Effective visible/ordered columns supplied by the Grid shell or adapter. */
  readonly getColumns: () => readonly TableClipboardColumn<Row>[]
  readonly copyFormat?: TableCopyFormat
  readonly copyWithFormat?: boolean
  /** Reads computed/projected values without materializing them into the row source. */
  readonly resolveValue?: TableClipboardValueResolver<Row>
  readonly parseValue?: (text: string, row: Row, column: TableClipboardColumn<Row>) => unknown
  readonly setValue?: (row: Row, column: TableClipboardColumn<Row>, value: unknown) => Row
  readonly isCellEditable?: (
    row: Row,
    column: TableClipboardColumn<Row>,
    rowIndex: number,
    columnIndex: number,
  ) => boolean
  /**
   * Maps edited effective rows back into the standard row source. Useful when
   * range coordinates address a sorted, filtered, or flattened projection.
   */
  readonly reconcileRows?: (
    sourceRows: readonly Row[],
    previousRows: readonly Row[],
    rows: readonly Row[],
  ) => readonly Row[]
  /** Adapter metadata forwarded through the single rows transaction. */
  readonly commitOptions?: GridRowsCommitOptions | (() => GridRowsCommitOptions)
  readonly onCopy?: (change: GridClipboardCopyChange) => void
  readonly onPaste?: (change: GridClipboardPasteChange<Row>) => void
}

export interface GridClipboardBindings<Row extends Record<string, unknown>> {
  getRows(): Row[]
  setRows(rows: Row[], options?: GridRowsCommitOptions): boolean
  getRange(): TableClipboardRange | null
}

interface GridClipboardContext<Row extends Record<string, unknown>> {
  sourceRows: Row[]
  rows: Row[]
  columns: readonly TableClipboardColumn<Row>[]
  range: TableClipboardRange
}

export interface GridClipboardModel {
  serialize(format?: TableCopyFormat, copyWithFormat?: boolean): string | null
  paste(text: string, range?: TableClipboardRange): boolean
}

export interface GridClipboardMethods {
  getClipboardModel(): GridClipboardModel
  serializeGridRange(format?: TableCopyFormat, copyWithFormat?: boolean): string | null
  pasteGridRange(text: string, range?: TableClipboardRange): boolean
}

function integer(value: number): number | null {
  return Number.isFinite(value) ? Math.trunc(value) : null
}

function clampRange(
  range: TableClipboardRange | null,
  rowCount: number,
  columnCount: number,
): TableClipboardRange | null {
  if (!range || rowCount <= 0 || columnCount <= 0) return null
  const raw = [
    integer(range.start.row),
    integer(range.start.col),
    integer(range.end.row),
    integer(range.end.col),
  ]
  if (raw.some((value) => value === null)) return null
  const [startRow, startColumn, endRow, endColumn] = raw as [number, number, number, number]
  return {
    start: {
      row: Math.max(0, Math.min(startRow, endRow, rowCount - 1)),
      col: Math.max(0, Math.min(startColumn, endColumn, columnCount - 1)),
    },
    end: {
      row: Math.max(0, Math.min(Math.max(startRow, endRow), rowCount - 1)),
      col: Math.max(0, Math.min(Math.max(startColumn, endColumn), columnCount - 1)),
    },
  }
}

function copiedSize(range: TableClipboardRange): { rowCount: number; columnCount: number } {
  return {
    rowCount: range.end.row - range.start.row + 1,
    columnCount: range.end.col - range.start.col + 1,
  }
}

function sameRows<Row extends Record<string, unknown>>(
  left: readonly Row[],
  right: readonly Row[],
): boolean {
  if (left.length !== right.length) return false
  return left.every((row, index) => Object.is(row, right[index]))
}

function defaultSetValue<Row extends Record<string, unknown>>(
  row: Row,
  column: TableClipboardColumn<Row>,
  value: unknown,
): Row {
  const key = column.dataIndex ?? column.key
  return { ...row, [key]: value }
}

class GridClipboardEngine<Row extends Record<string, unknown>> implements GridClipboardModel {
  constructor(
    private readonly options: GridClipboardFeatureOptions<Row>,
    private readonly bindings: GridClipboardBindings<Row>,
    private readonly emit?: (change: GridClipboardChange<Row>) => void,
  ) {}

  private context(rangeOverride?: TableClipboardRange): GridClipboardContext<Row> | null {
    const sourceRows = this.bindings.getRows()
    const rows = [...(this.options.getRows?.() ?? sourceRows)]
    const columns = this.options.getColumns()
    const range = clampRange(rangeOverride ?? this.bindings.getRange(), rows.length, columns.length)
    return range ? { sourceRows, rows, columns, range } : null
  }

  serialize(format = this.options.copyFormat ?? 'tsv', copyWithFormat?: boolean): string | null {
    const current = this.context()
    if (!current) return null
    const normalizedFormat = format === 'csv' || format === 'html' ? format : 'tsv'
    const text = serializeTableRange(
      current.rows,
      current.columns,
      current.range,
      normalizedFormat,
      copyWithFormat ?? this.options.copyWithFormat ?? false,
      this.options.resolveValue,
    )
    const change: GridClipboardCopyChange = {
      type: 'copy',
      format: normalizedFormat,
      range: current.range,
      ...copiedSize(current.range),
    }
    this.options.onCopy?.(change)
    this.emit?.(change)
    return text
  }

  private pasteRow(
    row: Row,
    values: readonly string[],
    rowIndex: number,
    startColumn: number,
    maxColumn: number,
    columns: readonly TableClipboardColumn<Row>[],
  ): { row: Row; changedCells: number } {
    let nextRow = row
    let changedCells = 0
    for (let columnOffset = 0; columnOffset < values.length; columnOffset += 1) {
      const columnIndex = startColumn + columnOffset
      if (columnIndex > maxColumn) break
      const column = columns[columnIndex]!
      if (
        this.options.isCellEditable &&
        !this.options.isCellEditable(nextRow, column, rowIndex, columnIndex)
      ) {
        continue
      }
      const raw = values[columnOffset]!
      const value = this.options.parseValue ? this.options.parseValue(raw, nextRow, column) : raw
      if (Object.is(resolveTableValue(nextRow, column), value)) continue
      const updated = (this.options.setValue ?? defaultSetValue)(nextRow, column, value)
      if (Object.is(updated, nextRow)) continue
      nextRow = updated
      changedCells += 1
    }
    return { row: nextRow, changedCells }
  }

  private commitPaste(
    current: GridClipboardContext<Row>,
    nextRows: Row[],
    changedRows: number,
    changedCells: number,
  ): boolean {
    const committedRows = [
      ...(this.options.reconcileRows?.(current.sourceRows, current.rows, nextRows) ?? nextRows),
    ]
    if (sameRows(current.sourceRows, committedRows)) return false
    const configuredOptions =
      typeof this.options.commitOptions === 'function'
        ? this.options.commitOptions()
        : this.options.commitOptions
    if (
      !this.bindings.setRows(committedRows, {
        reason: 'clipboard-paste',
        ...configuredOptions,
      })
    )
      return false
    const change: GridClipboardPasteChange<Row> = {
      type: 'paste',
      range: current.range,
      previousRows: current.sourceRows,
      rows: committedRows,
      changedRows,
      changedCells,
    }
    this.options.onPaste?.(change)
    this.emit?.(change)
    return true
  }

  paste(text: string, range?: TableClipboardRange): boolean {
    const current = this.context(range)
    if (!current) return false
    const lines = text.split(/\r?\n/)
    const multiCell =
      current.range.start.row !== current.range.end.row ||
      current.range.start.col !== current.range.end.col
    const maxRow = multiCell ? current.range.end.row : current.rows.length - 1
    const maxColumn = multiCell ? current.range.end.col : current.columns.length - 1
    const nextRows = [...current.rows]
    const changedRowIndexes = new Set<number>()
    let changedCells = 0
    for (let rowOffset = 0; rowOffset < lines.length; rowOffset += 1) {
      const rowIndex = current.range.start.row + rowOffset
      if (rowIndex > maxRow) break
      const values = lines[rowOffset]!.split('\t')
      const result = this.pasteRow(
        nextRows[rowIndex]!,
        values,
        rowIndex,
        current.range.start.col,
        maxColumn,
        current.columns,
      )
      nextRows[rowIndex] = result.row
      changedCells += result.changedCells
      if (result.changedCells > 0) changedRowIndexes.add(rowIndex)
    }
    if (changedCells === 0) return false
    return this.commitPaste(current, nextRows, changedRowIndexes.size, changedCells)
  }
}

export function createGridClipboardModel<Row extends Record<string, unknown>>(
  options: GridClipboardFeatureOptions<Row>,
  bindings: GridClipboardBindings<Row>,
  emit?: (change: GridClipboardChange<Row>) => void,
): GridClipboardModel {
  return new GridClipboardEngine(options, bindings, emit)
}

/** Optional clipboard capability composed over rows + range; system I/O stays adapter-owned. */
export function createGridClipboardFeature<Row extends Record<string, unknown>>(
  options: GridClipboardFeatureOptions<Row>,
): GridFeature<Row> {
  return {
    name: 'clipboard',
    dependsOn: ['rows', 'range'],
    setup(context) {
      const model = createGridClipboardModel(
        options,
        {
          getRows: () => context.core.invoke<Row[]>('getRows'),
          setRows: (rows, commitOptions) =>
            context.core.invoke<boolean>('setRows', rows, commitOptions),
          getRange: () => context.core.invoke<TableClipboardRange | null>('getCellRange'),
        },
        (change) => context.emit(GRID_CLIPBOARD_CHANGE_EVENT, change),
      )
      const methods: GridClipboardMethods = {
        getClipboardModel: () => model,
        serializeGridRange: (format, copyWithFormat) => model.serialize(format, copyWithFormat),
        pasteGridRange: (text, range) => model.paste(text, range),
      }
      return { methods: methods as unknown as Readonly<Record<string, GridMethod>> }
    },
  }
}
