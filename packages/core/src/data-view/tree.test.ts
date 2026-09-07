import { describe, expect, it } from 'vitest'
import { projectTableBodyRows } from './tree'

type Row = {
  id: number
  name: string
  children?: Row[]
}

const child: Row = { id: 2, name: 'child' }
const root: Row = { id: 1, name: 'root', children: [child] }
const leaf: Row = { id: 3, name: 'leaf' }

const treeOptions = (expanded: ReadonlySet<string>) => ({
  getKey: (row: Row) => String(row.id),
  getChildren: (row: Row) => row.children,
  isExpanded: (key: string) => expanded.has(key),
})

describe('projectTableBodyRows', () => {
  it('keeps the default flat path source-ordered and tree-free', () => {
    const rows = [root, leaf]
    const views = projectTableBodyRows(rows)

    expect(views.map((view) => [view.row.id, view.rowIndex, view.treeMeta])).toEqual([
      [1, 0, null],
      [3, 1, null],
    ])
    expect(views[0]!.row).toBe(root)
    expect(views[1]!.row).toBe(leaf)
  })

  it('projects expanded and collapsed trees with depth and expansion metadata', () => {
    const collapsed = projectTableBodyRows([root, leaf], treeOptions(new Set()))
    expect(collapsed.map((view) => view.row.id)).toEqual([1, 3])
    expect(collapsed[0]!.treeMeta).toMatchObject({
      key: '1',
      depth: 0,
      hasChildren: true,
      expanded: false,
      setSize: 2,
      posInset: 1,
    })

    const expanded = projectTableBodyRows([root, leaf], treeOptions(new Set(['1'])))
    expect(expanded.map((view) => view.row.id)).toEqual([1, 2, 3])
    expect(expanded.map((view) => view.rowIndex)).toEqual([0, 1, 2])
    expect(expanded[1]!.treeMeta).toMatchObject({
      key: '2',
      depth: 1,
      hasChildren: false,
      expanded: false,
      setSize: 1,
      posInset: 1,
    })
    expect(expanded[1]!.row).toBe(child)
  })

  it('places newly supplied lazy children immediately without cloning source rows', () => {
    const lazyRoot: Row = { id: 10, name: 'lazy root' }
    const currentChildren = new Map<Row, Row[]>()
    const options = {
      getKey: (row: Row) => String(row.id),
      getChildren: (row: Row) => currentChildren.get(row),
      isExpanded: (key: string) => key === '10',
    }

    const before = projectTableBodyRows([lazyRoot], options)
    expect(before.map((view) => view.row.id)).toEqual([10])

    const lazyChild: Row = { id: 11, name: 'loaded' }
    currentChildren.set(lazyRoot, [lazyChild])
    const after = projectTableBodyRows([lazyRoot], options)
    expect(after.map((view) => view.row.id)).toEqual([10, 11])
    expect(after[0]!.row).toBe(lazyRoot)
    expect(after[1]!.row).toBe(lazyChild)
    expect(after[0]!.treeMeta?.expanded).toBe(true)
  })

  it('does not infer a tree or group/body pseudo-entries on the flat path', () => {
    const groupedLikeRows = [
      { ...root, groupKey: 'Engineering' } as Row & { groupKey: string },
      { ...leaf, groupKey: 'Operations' } as Row & { groupKey: string },
    ]
    const views = projectTableBodyRows(groupedLikeRows)

    expect(views).toHaveLength(2)
    expect(views.every((view) => view.treeMeta === null)).toBe(true)
    expect(views.map((view) => view.row.id)).toEqual([1, 3])
  })

  it('creates fresh view entries while preserving row identity', () => {
    const first = projectTableBodyRows([root, leaf], treeOptions(new Set()))
    const second = projectTableBodyRows([root, leaf], treeOptions(new Set()))

    expect(second).not.toBe(first)
    expect(second[0]).not.toBe(first[0])
    expect(second[0]!.row).toBe(first[0]!.row)
    expect(second[0]!.treeMeta).not.toBe(first[0]!.treeMeta)
  })
})
