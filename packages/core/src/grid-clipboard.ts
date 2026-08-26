import type { GridFeature, GridMethod } from './grid'
import type { GridRowsCommitOptions } from './grid-rows'
import { insertRowInList } from './table-rows'
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

export interface GridClipboardOverflowContext<Row extends Record<string, unknown>> {
  /** Clipboard lines that start after the effective body rows are exhausted. */
  readonly lines: readonly (readonly string[])[]
  readonly range: TableClipboardRange
  readonly columns: readonly TableClipboardColumn<Row>[]
  readonly parseValue: (text: string, row: Row, column: TableClipboardColumn<Row>) => unknown
  readonly isCellEditable: (
    row: Row,
    column: TableClipboardColumn<Row>,
    rowIndex: number,
    columnIndex: number,
  ) => boolean
  readonly setValue: (row: Row, column: TableClipboardColumn<Row>, value: unknown) => Row
  readonly rowKeyField: string
}

export const GRID_CLIPBOARD_CHANGE_EVENT = 'clipboard:change'

export interface GridClipboardFeatureOptions<Row extends Record<string, unknown>> {
  /** Effective visible/ordered rows; defaults to the standard rows feature snapshot. */
  readonly getRows?: () => readonly Row[]
  /** Effective visible/ordered columns supplied by the Grid shell or adapter. */
  readonly getColumns: () => readonly TableClipboardColumn<Row>[]
  readonly copyFormat?: TableCopyFormat
  readonly copyWithFormat?: boolean
  /** Field used to auto-key rows returned by `overflowRows`; defaults to `id`. */
  readonly rowKeyField?: string
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
  /** Creates rows for single-cell paste lines beyond the effective body. */
  readonly overflowRows?: (context: GridClipboardOverflowContext<Row>) => readonly Row[] | undefined
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
  allowEmptyRows = false,
): TableClipboardRange | null {
  if (!range || columnCount <= 0 || (rowCount <= 0 && !allowEmptyRows)) return null
  const raw = [
    integer(range.start.row),
    integer(range.start.col),
    integer(range.end.row),
    integer(range.end.col),
  ]
  if (raw.some((value) => value === null)) return null
  const [startRow, startColumn, endRow, endColumn] = raw as [number, number, number, number]
  // A factory-backed single-cell paste may legitimately start with no source
  // rows. Keep the range at row zero so every clipboard line is treated as an
  // overflow line; serialization and the default (factory-less) path still
  // reject an empty body above.
  const lastRow = Math.max(0, rowCount - 1)
  return {
    start: {
      row: Math.max(0, Math.min(startRow, endRow, lastRow)),
      col: Math.max(0, Math.min(startColumn, endColumn, columnCount - 1)),
    },
    end: {
      row: Math.max(0, Math.min(Math.max(startRow, endRow), lastRow)),
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

function countOverflowCells<Row extends Record<string, unknown>>(
  row: Row,
  range: TableClipboardRange,
  columns: readonly TableClipboardColumn<Row>[],
): number {
  let count = 0
  for (let columnIndex = range.start.col; columnIndex < columns.length; columnIndex += 1) {
    const column = columns[columnIndex]!
    const key = column.dataIndex ?? column.key
    if (Object.prototype.hasOwnProperty.call(row, key)) count += 1
  }
  return count
}

class GridClipboardEngine<Row extends Record<string, unknown>> implements GridClipboardModel {
  constructor(
    private readonly options: GridClipboardFeatureOptions<Row>,
    private readonly bindings: GridClipboardBindings<Row>,
    private readonly emit?: (change: GridClipboardChange<Row>) => void,
  ) {}

  private context(
    rangeOverride?: TableClipboardRange,
    allowEmptyRows = false,
  ): GridClipboardContext<Row> | null {
    const sourceRows = this.bindings.getRows()
    const rows = [...(this.options.getRows?.() ?? sourceRows)]
    const columns = this.options.getColumns()
    const range = clampRange(
      rangeOverride ?? this.bindings.getRange(),
      rows.length,
      columns.length,
      allowEmptyRows,
    )
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

  private collectOverflowLines(
    lines: readonly string[],
    rowOffset: number,
    multiCell: boolean,
  ): string[][] {
    if (multiCell) return []
    return lines.slice(rowOffset).map((line) => line.split('\t'))
  }

  private appendOverflowRows(
    current: GridClipboardContext<Row>,
    lines: readonly (readonly string[])[],
    nextRows: Row[],
  ): { rowCount: number; cellCount: number } {
    const factory = this.options.overflowRows
    if (!factory || lines.length === 0) return { rowCount: 0, cellCount: 0 }
    const rowKeyField = this.options.rowKeyField ?? 'id'
    const overflowRows = factory({
      lines,
      range: current.range,
      columns: current.columns,
      parseValue: this.options.parseValue ?? ((text) => text),
      isCellEditable: this.options.isCellEditable ?? (() => true),
      setValue: this.options.setValue ?? defaultSetValue,
      rowKeyField,
    })
    if (!overflowRows || overflowRows.length === 0) return { rowCount: 0, cellCount: 0 }

    let rowsForKeys = current.sourceRows
    let rowCount = 0
    let cellCount = 0
    for (const row of overflowRows) {
      const inserted = insertRowInList(rowsForKeys, rowKeyField, row)
      const insertedRow = inserted[inserted.length - 1]
      if (!insertedRow) continue
      rowsForKeys = inserted
      nextRows.push(insertedRow)
      rowCount += 1
      cellCount += countOverflowCells(row, current.range, current.columns)
    }
    return { rowCount, cellCount }
  }

  paste(text: string, range?: TableClipboardRange): boolean {
    // An opt-in overflow factory is also useful for an initially empty grid:
    // the first single-cell paste has no existing row to anchor to, so treat
    // row zero as the overflow boundary. Without a factory, preserve the
    // historical no-range/no-row no-op.
    const current = this.context(range, this.options.overflowRows !== undefined)
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
    let overflowLines: string[][] = []
    for (let rowOffset = 0; rowOffset < lines.length; rowOffset += 1) {
      const rowIndex = current.range.start.row + rowOffset
      if (rowIndex > maxRow) {
        overflowLines = this.collectOverflowLines(lines, rowOffset, multiCell)
        break
      }
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

    const overflow = this.appendOverflowRows(current, overflowLines, nextRows)
    changedCells += overflow.cellCount
    if (changedCells === 0 && overflow.rowCount === 0) return false
    return this.commitPaste(
      current,
      nextRows,
      changedRowIndexes.size + overflow.rowCount,
      changedCells,
    )
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
