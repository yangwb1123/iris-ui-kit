import { describe, expect, it, vi } from 'vitest'
import {
  createGridCore,
  createGridRowsFeature,
  GRID_ROWS_CHANGE_EVENT,
  type GridRowsModel,
} from './grid'
import { reorderTreeRows } from './grid-tree-rows'

describe('reorderTreeRows', () => {
  it('fails closed when a duplicate or cyclic branch follows valid drag targets', () => {
    type TreeRow = { id: number; children?: TreeRow[] }
    const from: TreeRow = { id: 2 }
    const to: TreeRow = { id: 3 }
    const duplicate: TreeRow = { id: 2 }
    const cyclic: TreeRow = { id: 4 }
    cyclic.children = [cyclic]
    const root: TreeRow = { id: 1, children: [from, to, duplicate, cyclic] }
    const source = [root]
    const options = {
      getRowKey: (row: TreeRow) => row.id,
      getChildren: (row: TreeRow) => row.children,
    }

    expect(reorderTreeRows(source, 2, 3, options)).toMatchObject({
      matched: true,
      changed: false,
      blocked: true,
    })
    expect(source[0]?.children).toEqual([from, to, duplicate, cyclic])
  })

  it('keeps the rows transaction silent when the source tree is malformed', () => {
    type TreeRow = { id: number; children?: TreeRow[] }
    const from: TreeRow = { id: 2 }
    const to: TreeRow = { id: 3 }
    const duplicate: TreeRow = { id: 2 }
    const root: TreeRow = { id: 1, children: [from, to, duplicate] }
    const core = createGridCore<TreeRow>({
      features: [
        createGridRowsFeature<TreeRow>({
          defaultRows: [root],
          getRowKey: (row) => row.id,
          getChildren: (row) => row.children,
        }),
      ],
    })
    const changed = vi.fn()
    core.on(GRID_ROWS_CHANGE_EVENT, changed)
    const model = core.invoke<GridRowsModel<TreeRow>>('getRowsModel')

    expect(model.reorder(2, 3, { reason: 'row-drag' })).toBe(false)
    expect(model.get()).toEqual([root])
    expect(changed).not.toHaveBeenCalled()
  })
})
