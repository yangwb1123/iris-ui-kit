import { describe, expect, it } from 'vitest'
import { removeTreeRows, setTreeChildren, updateTreeRows } from './grid-tree-rows'

describe('tree mutation audit reproduction', () => {
  it('fails closed for every keyed mutation in a malformed tree', () => {
    type Row = { id: number; name: string; children?: Row[] }
    const target: Row = { id: 2, name: 'target' }
    const duplicate: Row = { id: 2, name: 'duplicate' }
    const cyclic: Row = { id: 3, name: 'cycle' }
    cyclic.children = [cyclic]
    const root: Row = { id: 1, name: 'root', children: [target, duplicate, cyclic] }

    const result = updateTreeRows(
      [root],
      2,
      { name: 'updated' },
      {
        getRowKey: (row) => row.id,
        getChildren: (row) => row.children,
      },
    )

    expect(result).toMatchObject({ matched: true, changed: false, blocked: true })

    expect(
      setTreeChildren([root], 2, [{ id: 4, name: 'loaded' }], {
        getRowKey: (row) => row.id,
        getChildren: (row) => row.children,
      }),
    ).toMatchObject({ matched: true, changed: false, blocked: true })
    expect(
      removeTreeRows([root], new Set([2]), {
        getRowKey: (row) => row.id,
        getChildren: (row) => row.children,
      }),
    ).toMatchObject({ matched: true, changed: false, blocked: true })
  })
})
