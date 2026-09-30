import { describe, expect, it, vi } from 'vitest'
import { collectTreeRows, reconcileTreeRows, reorderTreeRows } from './grid'

describe('createGridRowsFeature tree helpers', () => {
  it('collects reachable tree rows once and stops on cycles or duplicate keys', () => {
    type TreeRow = { id: number; children?: TreeRow[] }
    const root: TreeRow = { id: 1 }
    const child: TreeRow = { id: 2 }
    const duplicate: TreeRow = { id: 2 }
    root.children = [child]
    child.children = [root]

    expect(
      collectTreeRows([root, duplicate], {
        getRowKey: (row) => row.id,
        getChildren: (row) => row.children,
      }),
    ).toEqual([root, child])
  })

  it('reconciles flattened child patches into one immutable root tree', () => {
    type TreeRow = { id: number; name: string; children?: TreeRow[] }
    const child: TreeRow = { id: 2, name: 'Child' }
    const root: TreeRow = { id: 1, name: 'Root', children: [child] }
    const source = [root]
    const patchedChild: TreeRow = { ...child, name: 'Updated' }

    const next = reconcileTreeRows(source, new Map([[2, patchedChild]]), {
      getRowKey: (row) => row.id,
      getChildren: (row) => row.children,
    })

    expect(next).not.toBe(source)
    expect(next[0]).not.toBe(root)
    expect(next[0]?.children?.[0]).toBe(patchedChild)
    expect(next[0]?.children?.[0]?.name).toBe('Updated')
    expect(source[0]).toBe(root)
    expect(source[0]?.children?.[0]).toBe(child)
    expect(
      reconcileTreeRows(source, new Map(), {
        getRowKey: (row) => row.id,
        getChildren: (row) => row.children,
      }),
    ).toBe(source)
  })

  it('keeps collapsed children when a replacement row omits the child slot', () => {
    type TreeRow = { id: number; name: string; children?: TreeRow[] }
    const child: TreeRow = { id: 2, name: 'Child' }
    const root: TreeRow = { id: 1, name: 'Root', children: [child] }
    const patchedRoot: TreeRow = { id: 1, name: 'Renamed' }
    const patchedChild: TreeRow = { id: 2, name: 'Updated child' }

    const next = reconcileTreeRows(
      [root],
      new Map([
        [1, patchedRoot],
        [2, patchedChild],
      ]),
      {
        getRowKey: (row) => row.id,
        getChildren: (row) => row.children,
      },
    )

    expect(next[0]).not.toBe(patchedRoot)
    expect(next[0]).toMatchObject({ id: 1, name: 'Renamed' })
    expect(next[0]?.children?.[0]).toBe(patchedChild)
    expect(root.children?.[0]).toBe(child)
  })

  it('reorders same-parent tree rows without flattening or mutating the source', () => {
    type TreeRow = { id: number; name: string; children?: TreeRow[] }
    const childA: TreeRow = { id: 2, name: 'A' }
    const childB: TreeRow = { id: 3, name: 'B' }
    const root: TreeRow = { id: 1, name: 'Root', children: [childA, childB] }
    const sibling: TreeRow = { id: 4, name: 'Sibling' }
    const source = [root, sibling]

    const next = reorderTreeRows(source, '2', '3', {
      getRowKey: (row) => String(row.id),
      getChildren: (row) => row.children,
    })

    expect(next).toMatchObject({ matched: true, changed: true, blocked: false })
    expect(next.rows.map((row) => row.id)).toEqual([1, 4])
    expect(next.rows[0]?.children?.map((row) => row.id)).toEqual([3, 2])
    expect(next.rows[0]).not.toBe(root)
    expect(next.rows[0]?.children).not.toBe(root.children)
    expect(next.rows[0]?.children?.[0]).toBe(childB)
    expect(source[0]).toBe(root)
    expect(source[0]?.children).toEqual([childA, childB])
  })

  it('honors visible drop direction when source siblings are sorted differently', () => {
    type TreeRow = { id: number; children?: TreeRow[] }
    const first: TreeRow = { id: 2 }
    const second: TreeRow = { id: 3 }
    const third: TreeRow = { id: 4 }
    const root: TreeRow = { id: 1, children: [second, third, first] }

    const next = reorderTreeRows(
      [root],
      2,
      3,
      {
        getRowKey: (row) => row.id,
        getChildren: (row) => row.children,
      },
      'after',
    )

    expect(next.changed).toBe(true)
    expect(next.rows[0]?.children?.map((row) => row.id)).toEqual([3, 2, 4])
  })

  it('blocks cross-parent moves and computed child lists without changing roots', () => {
    type TreeRow = { id: number; name: string; descendants: TreeRow[] }
    const firstChild = { id: 2, name: 'A', descendants: [] as TreeRow[] }
    const secondChild = { id: 3, name: 'B', descendants: [] as TreeRow[] }
    const first = { id: 1, name: 'First', descendants: [firstChild] }
    const second = { id: 4, name: 'Second', descendants: [secondChild] }
    const source = [first, second]
    const options = {
      getRowKey: (row: TreeRow) => row.id,
      getChildren: (row: TreeRow) => row.descendants,
    }

    expect(reorderTreeRows(source, 2, 3, options)).toMatchObject({
      matched: true,
      changed: false,
      blocked: true,
    })
    expect(reorderTreeRows(source, 2, 99, options)).toMatchObject({
      matched: false,
      changed: false,
      blocked: false,
    })
    expect(source[0]?.descendants).toEqual([firstChild])
    expect(source[1]?.descendants).toEqual([secondChild])
  })

  it('uses a custom child setter and guards duplicate/cyclic branches', () => {
    type TreeRow = { id: number; name: string; descendants: TreeRow[] }
    const root = { id: 1, name: 'Root', descendants: [] as TreeRow[] }
    const child = { id: 2, name: 'Child', descendants: [] as TreeRow[] }
    root.descendants = [child]
    child.descendants = [root]
    const duplicate = { id: 2, name: 'Duplicate', descendants: [] as TreeRow[] }
    const patched: TreeRow = { ...child, name: 'Patched', descendants: child.descendants }
    const setChildren = vi.fn((row: TreeRow, descendants: TreeRow[]) => ({
      ...row,
      descendants,
    }))

    const next = reconcileTreeRows([root, duplicate], new Map([[2, patched]]), {
      getRowKey: (row) => row.id,
      getChildren: (row) => row.descendants,
      setChildren,
    })

    expect(next).toHaveLength(2)
    expect(next[0]?.descendants[0]).toBe(patched)
    expect(next[1]).toBe(duplicate)
    expect(setChildren).toHaveBeenCalledTimes(1)
  })
})
