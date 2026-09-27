import { describe, expect, it, vi } from 'vitest'
import {
  createGridCore,
  createGridRowsFeature,
  GRID_ROWS_CHANGE_EVENT,
  type GridRowsModel,
} from './grid'
import { reconcileTreeRows, reorderTreeRows } from './grid-tree-rows'

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

describe('reconcileTreeRows', () => {
  it('keeps the source child slot when only the parent row is replaced without children', () => {
    type TreeRow = { id: number; name: string; children?: TreeRow[] }
    const leaf: TreeRow = { id: 3, name: 'Leaf' }
    const child: TreeRow = { id: 2, name: 'Child', children: [leaf] }
    const root: TreeRow = { id: 1, name: 'Root', children: [child] }
    const source = [root]
    const patchedRoot: TreeRow = { id: 1, name: 'Renamed' }

    const next = reconcileTreeRows(source, new Map([[1, patchedRoot]]), {
      getRowKey: (row) => row.id,
      getChildren: (row) => row.children,
    })

    expect(next).not.toBe(source)
    expect(next[0]).not.toBe(root)
    expect(next[0]).not.toBe(patchedRoot)
    expect(next[0]).toMatchObject({ id: 1, name: 'Renamed' })
    expect(next[0]?.children).toBe(root.children) // same array identity
    expect(next[0]?.children?.[0]).toBe(child) // untouched descendant identity
    expect(next[0]?.children?.[0]?.children?.[0]).toBe(leaf) // untouched leaf identity
    expect(patchedRoot.children).toBeUndefined() // patch input not mutated
    expect(source[0]).toBe(root)
    expect(root.children?.[0]).toBe(child)
  })

  it('keeps an untouched grandchild subtree when a middle row patch omits the child slot', () => {
    type TreeRow = { id: number; name: string; children?: TreeRow[] }
    const leaf: TreeRow = { id: 3, name: 'Leaf' }
    const middle: TreeRow = { id: 2, name: 'Middle', children: [leaf] }
    const root: TreeRow = { id: 1, name: 'Root', children: [middle] }
    const source = [root]
    const patchedMiddle: TreeRow = { id: 2, name: 'Middle renamed' }

    const next = reconcileTreeRows(source, new Map([[2, patchedMiddle]]), {
      getRowKey: (row) => row.id,
      getChildren: (row) => row.children,
    })

    expect(next[0]).not.toBe(root) // ancestor path rebuilt
    expect(next[0]?.children).not.toBe(root.children)
    expect(next[0]?.children?.[0]).not.toBe(middle)
    expect(next[0]?.children?.[0]).not.toBe(patchedMiddle)
    expect(next[0]?.children?.[0]).toMatchObject({ id: 2, name: 'Middle renamed' })
    expect(next[0]?.children?.[0]?.children).toBe(middle.children) // grandchild array identity
    expect(next[0]?.children?.[0]?.children?.[0]).toBe(leaf)
    expect(middle.children?.[0]).toBe(leaf) // source untouched
  })

  it('lets an explicit empty children patch clear the subtree', () => {
    type TreeRow = { id: number; name: string; children?: TreeRow[] }
    const child: TreeRow = { id: 2, name: 'Child' }
    const root: TreeRow = { id: 1, name: 'Root', children: [child] }
    const patchedRoot: TreeRow = { id: 1, name: 'Cleared', children: [] }

    const next = reconcileTreeRows([root], new Map([[1, patchedRoot]]), {
      getRowKey: (row) => row.id,
      getChildren: (row) => row.children,
    })

    expect(next[0]?.children).toBe(patchedRoot.children) // patch array retained, no merge
    expect(next[0]?.children).toEqual([])
    expect(next[0]?.children?.[0]).toBeUndefined()
    expect(root.children?.[0]).toBe(child) // source untouched
  })

  it('restores an omitted child slot through a custom child setter', () => {
    type TreeRow = { id: number; name: string; descendants?: TreeRow[] }
    const child: TreeRow = { id: 2, name: 'Child' }
    const root: TreeRow = { id: 1, name: 'Root', descendants: [child] }
    const patchedRoot: TreeRow = { id: 1, name: 'Renamed' }
    const setChildren = vi.fn((row: TreeRow, descendants: TreeRow[]) => ({ ...row, descendants }))

    const next = reconcileTreeRows([root], new Map([[1, patchedRoot]]), {
      getRowKey: (row) => row.id,
      getChildren: (row) => row.descendants,
      setChildren,
    })

    expect(setChildren).toHaveBeenCalledTimes(1)
    expect(setChildren.mock.calls[0]?.[0]).toBe(patchedRoot)
    expect(setChildren.mock.calls[0]?.[1]).toBe(root.descendants)
    expect(next[0]?.descendants?.[0]).toBe(child)
  })

  it('keeps the source list reference when the patch map points back at the source row', () => {
    type TreeRow = { id: number; name: string; children?: TreeRow[] }
    const child: TreeRow = { id: 2, name: 'Child' }
    const root: TreeRow = { id: 1, name: 'Root', children: [child] }
    const source = [root]

    expect(
      reconcileTreeRows(source, new Map([[1, root]]), {
        getRowKey: (row) => row.id,
        getChildren: (row) => row.children,
      }),
    ).toBe(source)
  })

  it('keeps a provided non-empty child array authoritative', () => {
    type TreeRow = { id: number; name: string; children?: TreeRow[] }
    const child: TreeRow = { id: 2, name: 'Child' }
    const root: TreeRow = { id: 1, name: 'Root', children: [child] }
    const own: TreeRow[] = [{ id: 9, name: 'Own' }]
    const patchedRoot: TreeRow = { id: 1, name: 'Renamed', children: own }

    const next = reconcileTreeRows([root], new Map([[1, patchedRoot]]), {
      getRowKey: (row) => row.id,
      getChildren: (row) => row.children,
    })

    expect(next[0]?.children).toBe(own)
    expect(root.children?.[0]).toBe(child)
  })

  it('keeps a computed child list without a setter fail-closed and non-throwing', () => {
    type TreeRow = { id: number; name?: string }
    const child: TreeRow = { id: 2, name: 'Child' }
    const root: TreeRow = { id: 1, name: 'Root' }
    const hidden = new Map<TreeRow, TreeRow[]>([[root, [child]]])
    const patchedRoot: TreeRow = { id: 1, name: 'Renamed' }

    const next = reconcileTreeRows([root], new Map([[1, patchedRoot]]), {
      getRowKey: (row) => row.id,
      getChildren: (row) => hidden.get(row),
    })

    expect(next[0]).toBe(patchedRoot)
    expect(hidden.get(root)?.[0]).toBe(child)
  })
})
