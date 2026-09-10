import { describe, expect, it, vi } from 'vitest'
import {
  createGridClipboardFeature,
  createGridCore,
  createGridRangeFeature,
  createGridRowsFeature,
  GRID_ROWS_CHANGE_EVENT,
  type TableClipboardColumn,
} from './grid'

type Row = { id: number; name: string }

const columns: TableClipboardColumn<Row>[] = [{ key: 'name', title: 'Name' }]

describe('grid clipboard malformed host payloads', () => {
  it('fails closed without committing non-text paste payloads', () => {
    const rowsChanged = vi.fn()
    const grid = createGridCore<Row>({
      features: [
        createGridRowsFeature<Row>({ defaultRows: [{ id: 1, name: 'Ada' }] }),
        createGridRangeFeature<Row>(),
        createGridClipboardFeature<Row>({ getColumns: () => columns }),
      ],
    })
    grid.on(GRID_ROWS_CHANGE_EVENT, rowsChanged)
    grid.invoke('startCellRange', 0, 0)

    expect(grid.invoke<boolean>('pasteGridRange', null as never)).toBe(false)
    expect(grid.invoke<boolean>('pasteGridRange', { text: 'Grace' } as never)).toBe(false)
    expect(grid.invoke<boolean>('pasteGridRange', undefined as never)).toBe(false)
    expect(grid.invoke<Row[]>('getRows')).toEqual([{ id: 1, name: 'Ada' }])
    expect(rowsChanged).not.toHaveBeenCalled()
  })
})
