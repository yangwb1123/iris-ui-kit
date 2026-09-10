import { describe, expect, it, vi } from 'vitest'
import {
  createGridClipboardFeature,
  createGridClipboardModel,
  createGridCore,
  createGridRangeFeature,
  createGridRowsFeature,
  GRID_CLIPBOARD_CHANGE_EVENT,
  type GridClipboardChange,
  type TableClipboardColumn,
} from './grid'
import { serializeTableRange } from './table-clipboard'

type Row = { id: number; name: string; age: number }

const columns: TableClipboardColumn<Row>[] = [
  { key: 'name', title: 'Name' },
  { key: 'age', title: 'Age' },
]

function gridWithRows(rows: Row[], options: Parameters<typeof createGridClipboardFeature<Row>>[0]) {
  return createGridCore<Row>({
    features: [
      createGridRowsFeature<Row>({ defaultRows: rows }),
      createGridRangeFeature<Row>(),
      createGridClipboardFeature<Row>(options),
    ],
  })
}

describe('grid clipboard/range boundary hardening', () => {
  it('normalizes fractional range coordinates and ignores non-finite updates', () => {
    const grid = createGridCore<Row>({ features: [createGridRangeFeature<Row>()] })

    grid.invoke('startCellRange', -1.8, -2.2)
    expect(grid.invoke('getCellRange')).toEqual({
      start: { row: -1, col: -2 },
      end: { row: -1, col: -2 },
    })
    grid.invoke('extendCellRange', Number.NaN, Number.POSITIVE_INFINITY)
    expect(grid.invoke('getCellRange')).toEqual({
      start: { row: -1, col: -2 },
      end: { row: -1, col: -2 },
    })
    expect(grid.invoke<boolean>('isCellInRange', Number.NaN, 0)).toBe(false)
  })

  it('fails closed for empty and partial direct serializer ranges', () => {
    expect(
      serializeTableRange([], columns, {
        start: { row: 0, col: 0 },
        end: { row: 0, col: 0 },
      }),
    ).toBe('')
    expect(
      serializeTableRange([{ id: 1, name: 'Ada', age: 30 }], columns, {
        start: null,
        end: { row: 0, col: 0 },
      } as never),
    ).toBe('')
  })

  it('avoids auto-key collisions with keys pasted before overflow rows', () => {
    const keyedColumns: TableClipboardColumn<Row>[] = [
      { key: 'id', title: 'ID' },
      { key: 'name', title: 'Name' },
    ]
    const grid = gridWithRows([{ id: 1, name: 'Ada', age: 30 }], {
      getColumns: () => keyedColumns,
      parseValue: (text, _row, column) => (column.key === 'id' ? Number(text) : text),
      overflowRows: ({ lines }) => lines.map((cells) => ({ name: cells[1] }) as Row),
    })
    grid.invoke('startCellRange', 0, 0)

    expect(grid.invoke<boolean>('pasteGridRange', '100\tUpdated\nignored\tOverflow')).toBe(true)
    expect(grid.invoke<Row[]>('getRows')).toEqual([
      { id: 100, name: 'Updated', age: 30 },
      { id: 101, name: 'Overflow' },
    ])
  })

  it('does not expose source rows to mutating paste callbacks', () => {
    const source = [{ id: 1, name: 'Ada', age: 30 }]
    let committed = source
    const model = createGridClipboardModel(
      {
        getColumns: () => columns,
        isCellEditable: (row) => {
          row.age = 999
          return true
        },
        parseValue: (text, row) => {
          row.name = 'parser mutation'
          return text
        },
        setValue: (row, column, value) => {
          row[column.key] = value
          return row
        },
      },
      {
        getRows: () => source,
        setRows: (next) => {
          committed = next
          return true
        },
        getRange: () => null,
      },
    )

    expect(model.paste('Grace', { start: { row: 0, col: 0 }, end: { row: 0, col: 0 } })).toBe(true)
    expect(source).toEqual([{ id: 1, name: 'Ada', age: 30 }])
    expect(committed).toEqual([{ id: 1, name: 'Grace', age: 30 }])
  })

  it('isolates callback change snapshots and rejects malformed rows', () => {
    const copyEvents: GridClipboardChange<Row>[] = []
    const grid = gridWithRows([{ id: 1, name: 'Ada', age: 30 }], {
      getColumns: () => columns,
      onCopy: (change) => {
        change.range.start.row = 99
      },
    })
    grid.on<GridClipboardChange<Row>>(GRID_CLIPBOARD_CHANGE_EVENT, (change) =>
      copyEvents.push(change),
    )
    grid.invoke('startCellRange', 0, 0)
    expect(grid.invoke<string>('serializeGridRange')).toBe('Ada')
    expect(copyEvents[0]).toMatchObject({ range: { start: { row: 0 } } })

    const model = createGridClipboardModel(
      { getColumns: () => columns, reconcileRows: () => [null as unknown as Row] },
      {
        getRows: () => [{ id: 1, name: 'Ada', age: 30 }],
        setRows: vi.fn(() => true),
        getRange: () => null,
      },
    )
    expect(
      model.paste('Grace', {
        start: { row: 0, col: 0 },
        end: { row: 0, col: 0 },
      }),
    ).toBe(false)
  })
})
