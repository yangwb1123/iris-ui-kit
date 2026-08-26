import { describe, expect, it, vi } from 'vitest'
import {
  createGridClipboardFeature,
  createGridCore,
  createGridRangeFeature,
  createGridRowsFeature,
  GRID_CLIPBOARD_CHANGE_EVENT,
  GRID_RANGE_CHANGE_EVENT,
  GRID_ROWS_CHANGE_EVENT,
  type GridClipboardChange,
  type GridRangeChange,
  type GridRangeModel,
  type GridRowsTransaction,
  type TableClipboardColumn,
} from './grid'

type Row = { id: number; name: string; age: number }

const rows: Row[] = [
  { id: 1, name: 'Ada', age: 30 },
  { id: 2, name: '=SUM(A1)', age: 40 },
]

const columns: TableClipboardColumn<Row>[] = [
  { key: 'name', title: 'Name' },
  { key: 'age', title: 'Age' },
]

function createClipboardGrid(
  overrides: Parameters<typeof createGridClipboardFeature<Row>>[0] = {
    getColumns: () => columns,
  },
) {
  return createGridCore<Row>({
    features: [
      createGridRowsFeature<Row>({ defaultRows: rows }),
      createGridRangeFeature<Row>(),
      createGridClipboardFeature<Row>(overrides),
    ],
  })
}

describe('createGridRangeFeature', () => {
  it('owns normalized range state, methods, callback, and event snapshots', () => {
    const onChange = vi.fn((change: GridRangeChange) => {
      if (change.state.anchor) change.state.anchor.row = 99
    })
    const events: GridRangeChange[] = []
    const grid = createGridCore<Row>({
      features: [createGridRangeFeature<Row>({ onChange })],
    })
    grid.on<GridRangeChange>(GRID_RANGE_CHANGE_EVENT, (change) => events.push(change))

    grid.invoke('startCellRange', 3, 2)
    grid.invoke('extendCellRange', 1, 0)

    expect(grid.invoke('getCellRange')).toEqual({
      start: { row: 1, col: 0 },
      end: { row: 3, col: 2 },
    })
    expect(grid.invoke<boolean>('isCellInRange', 2, 1)).toBe(true)
    expect(events.at(-1)).toEqual({
      state: { anchor: { row: 3, col: 2 }, active: { row: 1, col: 0 } },
      range: { start: { row: 1, col: 0 }, end: { row: 3, col: 2 } },
    })
    const snapshot = grid.invoke<GridRangeChange['state']>('getCellRangeState')
    snapshot.anchor!.row = 50
    expect(grid.invoke('getCellRangeState')).toMatchObject({ anchor: { row: 3, col: 2 } })
    expect(onChange).toHaveBeenCalledTimes(2)
  })

  it('unsubscribes feature events before a retained model changes after disposal', () => {
    const events = vi.fn()
    const grid = createGridCore<Row>({ features: [createGridRangeFeature<Row>()] })
    grid.on(GRID_RANGE_CHANGE_EVENT, events)
    const model = grid.invoke<GridRangeModel>('getRangeModel')
    grid.destroy()

    model.startRange(1, 1)
    expect(events).not.toHaveBeenCalled()
  })
})

describe('createGridClipboardFeature', () => {
  it('serializes the current rectangle with formula safety and copy events', () => {
    const onCopy = vi.fn()
    const events: GridClipboardChange<Row>[] = []
    const grid = createClipboardGrid({ getColumns: () => columns, onCopy })
    grid.on<GridClipboardChange<Row>>(GRID_CLIPBOARD_CHANGE_EVENT, (change) => events.push(change))
    grid.invoke('startCellRange', 0, 0)
    grid.invoke('extendCellRange', 1, 1)

    expect(grid.invoke<string>('serializeGridRange')).toBe("Ada\t30\n'=SUM(A1)\t40")
    expect(grid.invoke<string>('serializeGridRange', 'csv')).toBe("Ada,30\n'=SUM(A1),40")
    expect(onCopy).toHaveBeenLastCalledWith({
      type: 'copy',
      format: 'csv',
      range: { start: { row: 0, col: 0 }, end: { row: 1, col: 1 } },
      rowCount: 2,
      columnCount: 2,
    })
    expect(events.filter((change) => change.type === 'copy')).toHaveLength(2)
  })

  it('streams a single-cell TSV paste through one rows transaction', () => {
    const onPaste = vi.fn()
    const rowChanges: GridRowsTransaction<Row>[] = []
    const grid = createClipboardGrid({
      getColumns: () => columns,
      parseValue: (text, _row, column) => (column.key === 'age' ? Number(text) : text),
      onPaste,
    })
    grid.on<GridRowsTransaction<Row>>(GRID_ROWS_CHANGE_EVENT, (change) => rowChanges.push(change))
    grid.invoke('startCellRange', 0, 0)

    expect(grid.invoke<boolean>('pasteGridRange', 'Grace\t31\nLinus\t41')).toBe(true)
    expect(grid.invoke<Row[]>('getRows')).toEqual([
      { id: 1, name: 'Grace', age: 31 },
      { id: 2, name: 'Linus', age: 41 },
    ])
    expect(rowChanges).toHaveLength(1)
    expect(rowChanges[0]).toMatchObject({ reason: 'clipboard-paste' })
    expect(onPaste).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'paste', changedRows: 2, changedCells: 4 }),
    )
  })

  it('clips multi-cell paste to the rectangle and skips locked cells', () => {
    const grid = createClipboardGrid({
      getColumns: () => columns,
      parseValue: (text, _row, column) => (column.key === 'age' ? Number(text) : text),
      isCellEditable: (row, column) => !(row.id === 2 && column.key === 'name'),
    })
    grid.invoke('startCellRange', 0, 0)
    grid.invoke('extendCellRange', 1, 1)

    expect(grid.invoke<boolean>('pasteGridRange', 'A\t31\toverflow\nB\t41\nignored')).toBe(true)
    expect(grid.invoke<Row[]>('getRows')).toEqual([
      { id: 1, name: 'A', age: 31 },
      { id: 2, name: '=SUM(A1)', age: 41 },
    ])
  })

  it('reconciles an effective row projection and forwards adapter transaction metadata', () => {
    const projectedRows = [rows[1]!, rows[0]!]
    const rowChanges: GridRowsTransaction<Row, { auditType: string }>[] = []
    const grid = createGridCore<Row>({
      features: [
        createGridRowsFeature<Row, { auditType: string }>({
          defaultRows: rows,
          onRowsChange: (change) => rowChanges.push(change),
        }),
        createGridRangeFeature<Row>(),
        createGridClipboardFeature<Row>({
          getRows: () => projectedRows,
          getColumns: () => columns,
          resolveValue: (row, column) =>
            column.key === 'name' ? row.name.toUpperCase() : row[column.key as keyof Row],
          reconcileRows: (sourceRows, previousRows, nextRows) => {
            const changed = new Map<number, Row>()
            nextRows.forEach((row, index) => {
              if (!Object.is(row, previousRows[index])) changed.set(row.id, row)
            })
            return sourceRows.map((row) => changed.get(row.id) ?? row)
          },
          commitOptions: { meta: { auditType: 'paste' } },
        }),
      ],
    })
    grid.invoke('startCellRange', 1, 0)

    expect(grid.invoke<string>('serializeGridRange')).toBe('ADA')
    expect(
      grid.invoke<boolean>('pasteGridRange', 'Grace', {
        start: { row: 0, col: 0 },
        end: { row: 0, col: 0 },
      }),
    ).toBe(true)
    expect(grid.invoke<Row[]>('getRows')).toEqual([
      { id: 1, name: 'Ada', age: 30 },
      { id: 2, name: 'Grace', age: 40 },
    ])
    expect(rowChanges).toHaveLength(1)
    expect(rowChanges[0]).toMatchObject({
      reason: 'clipboard-paste',
      meta: { auditType: 'paste' },
    })
  })

  it('clamps out-of-bounds ranges and keeps no-range/no-change operations inert', () => {
    const clipboardEvents = vi.fn()
    const rowsChanged = vi.fn()
    const grid = createClipboardGrid()
    grid.on(GRID_CLIPBOARD_CHANGE_EVENT, clipboardEvents)
    grid.on(GRID_ROWS_CHANGE_EVENT, rowsChanged)

    expect(grid.invoke('serializeGridRange')).toBeNull()
    expect(grid.invoke<boolean>('pasteGridRange', 'x')).toBe(false)
    grid.invoke('startCellRange', -10, -10)
    grid.invoke('extendCellRange', 10, 10)
    expect(grid.invoke<string>('serializeGridRange')).toBe("Ada\t30\n'=SUM(A1)\t40")

    grid.invoke('startCellRange', 0, 0)
    expect(grid.invoke<boolean>('pasteGridRange', 'Ada')).toBe(false)
    expect(rowsChanged).not.toHaveBeenCalled()
    expect(clipboardEvents).toHaveBeenCalledTimes(1)
  })

  it('requires both standard rows and range features', () => {
    expect(() =>
      createGridCore<Row>({
        features: [createGridClipboardFeature<Row>({ getColumns: () => columns })],
      }),
    ).toThrow('requires missing feature "rows"')
    expect(() =>
      createGridCore<Row>({
        features: [
          createGridRowsFeature<Row>(),
          createGridClipboardFeature<Row>({ getColumns: () => columns }),
        ],
      }),
    ).toThrow('requires missing feature "range"')
  })
})
