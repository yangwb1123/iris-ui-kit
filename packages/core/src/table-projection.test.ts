import { describe, expect, it } from 'vitest'
import { reconcileProjectedRows } from './table-projection'

type Row = {
  id: number
  name: string
  children?: Row[]
}

const rows: Row[] = [
  { id: 1, name: 'one' },
  { id: 2, name: 'two' },
  { id: 3, name: 'three' },
]

describe('reconcileProjectedRows', () => {
  it('maps a sorted/filtered projection back by visible row identity', () => {
    const visible = [rows[2]!, rows[0]!, rows[1]!]
    const projected = [visible[0]!, { ...visible[1]!, name: 'ONE' }, visible[2]!]
    const result = reconcileProjectedRows(rows, visible, projected, {
      visibleRows: visible,
      getRowKey: (row) => row.id,
    })

    expect(result).not.toBe(rows)
    expect(result.map((row) => row.name)).toEqual(['ONE', 'two', 'three'])
    expect(result[0]).not.toBe(rows[0])
    expect(result[1]).toBe(rows[1])
    expect(result[2]).toBe(rows[2])
  })

  it('rebuilds only the tree ancestor path and preserves untouched identity', () => {
    const child: Row = { id: 2, name: 'child' }
    const root: Row = { id: 1, name: 'root', children: [child] }
    const sibling: Row = { id: 3, name: 'sibling' }
    const source = [root, sibling]
    const visible = [root, child, sibling]
    const projectedChild = { ...child, name: 'CHILD' }
    const result = reconcileProjectedRows(source, visible, [root, projectedChild, sibling], {
      visibleRows: visible,
      getRowKey: (row) => row.id,
      getChildren: (row) => row.children,
    })

    expect(result[0]).not.toBe(root)
    expect(result[0]!.children![0]).toBe(projectedChild)
    expect(result[1]).toBe(sibling)
    expect(result[0]!.children).not.toBe(root.children)
  })

  it('fails closed for duplicate keys in a tree projection write-back', () => {
    const first: Row = { id: 2, name: 'first', children: [] }
    const second: Row = { id: 2, name: 'second', children: [] }
    const source: Row[] = [
      { id: 1, name: 'root-a', children: [first] },
      { id: 3, name: 'root-b', children: [second] },
    ]
    const visible = [first, second]
    const result = reconcileProjectedRows(
      source,
      visible,
      [{ ...first, name: 'patched' }, second],
      {
        visibleRows: visible,
        getRowKey: (row) => row.id,
        getChildren: (row) => row.children,
      },
    )

    expect(result).toBe(source)
    expect(source[0]?.children?.[0]).toBe(first)
    expect(source[1]?.children?.[0]).toBe(second)
  })

  it('returns the original flat source list when the projection has no changes', () => {
    const result = reconcileProjectedRows(
      rows,
      [rows[2]!, rows[0]!, rows[1]!],
      [rows[2]!, rows[0]!, rows[1]!],
      {
        visibleRows: [rows[2]!, rows[0]!, rows[1]!],
        getRowKey: (row) => row.id,
      },
    )

    expect(result).toBe(rows)
  })

  it('maps a keyless sorted flat projection back by the original source slot', () => {
    const source = [{ name: 'B' }, { name: 'A' }]
    const visible = [source[1]!, source[0]!]
    const result = reconcileProjectedRows(source, visible, [{ name: 'A!' }, visible[1]!], {
      visibleRows: visible,
      getRowKey: (_row, index) => index,
    })

    expect(result).toEqual([{ name: 'B' }, { name: 'A!' }])
    expect(result[0]).toBe(source[0])
    expect(result[1]).not.toBe(source[1])
  })

  it('does not fan one flat duplicate-key patch across every sibling', () => {
    const source = [
      { id: 1, name: 'first' },
      { id: 1, name: 'second' },
    ]
    const result = reconcileProjectedRows(
      source,
      source,
      [source[0]!, { ...source[1]!, name: 'SECOND' }],
      {
        visibleRows: source,
        getRowKey: (row) => row.id,
      },
    )

    expect(result).toEqual([
      { id: 1, name: 'first' },
      { id: 1, name: 'SECOND' },
    ])
    expect(result[0]).toBe(source[0])
    expect(result[1]).not.toBe(source[1])
  })

  it('fails closed when the same flat row object appears twice', () => {
    const shared = { id: 1, name: 'shared' }
    const source = [shared, shared]
    const result = reconcileProjectedRows(
      source,
      source,
      [shared, { ...shared, name: 'patched' }],
      {
        visibleRows: source,
        getRowKey: (row) => row.id,
      },
    )

    expect(result).toBe(source)
  })
})
