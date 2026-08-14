import { describe, expect, it } from 'vitest'
import { diffRows } from './diff-rows'
import type { RowDiff, RowDiffCellChange } from './diff-rows'

interface Row extends Record<string, unknown> {
  id: number
  name: string
  age: number
}

const before: Row[] = [
  { id: 1, name: 'A', age: 10 },
  { id: 2, name: 'B', age: 20 },
  { id: 3, name: 'C', age: 30 },
]

const after: Row[] = [
  { id: 2, name: 'B', age: 21 }, // changed (age)
  { id: 3, name: 'C', age: 30 }, // unchanged
  { id: 4, name: 'D', age: 40 }, // added
]

describe('diffRows', () => {
  it('classifies added / removed / changed keys', () => {
    const d = diffRows(before, after, 'id')
    expect(d.added).toEqual([4])
    expect(d.removed).toEqual([1])
    expect(d.changed).toEqual([2])
    expect(d.status.get(1)).toBe('removed')
    expect(d.status.get(2)).toBe('changed')
    expect(d.status.get(3)).toBeUndefined()
    expect(d.status.get(4)).toBe('added')
  })

  it('reports changed cells with old → new values', () => {
    const d = diffRows(before, after, 'id')
    const cells = d.cellChanges.get(2)!
    expect(cells.size).toBe(1)
    expect(cells.get('age')).toEqual({ key: 'age', oldValue: 20, newValue: 21 })
  })

  it('keyed by rowKeyField, not by position', () => {
    const b = [{ id: 'a', v: 1 }]
    const a = [{ id: 'a', v: 2 }]
    const d = diffRows(b, a, 'id')
    expect(d.changed).toEqual(['a'])
  })

  it('uses Object.is semantics — NaN equals NaN (not a change)', () => {
    const b = [{ id: 1, v: NaN }]
    const a = [{ id: 1, v: NaN }]
    const d = diffRows(b, a, 'id')
    expect(d.changed).toEqual([])
  })

  it('uses Object.is semantics — +0 differs from -0', () => {
    const d = diffRows([{ id: 1, v: 0 }], [{ id: 1, v: -0 }], 'id')
    expect(d.changed).toEqual([1])
  })

  it('equal lists yield an empty diff', () => {
    const d = diffRows(before, [...before], 'id')
    expect(d.added).toEqual([])
    expect(d.removed).toEqual([])
    expect(d.changed).toEqual([])
    expect(d.status.size).toBe(0)
    expect(d.cellChanges.size).toBe(0)
  })

  it('empty before → everything added', () => {
    const d = diffRows<Row>([], after, 'id')
    expect(d.added).toEqual([2, 3, 4])
    expect(d.removed).toEqual([])
    expect(d.changed).toEqual([])
  })

  it('empty after → everything removed', () => {
    const d = diffRows(before, [], 'id')
    expect(d.removed).toEqual([1, 2, 3])
    expect(d.added).toEqual([])
    expect(d.changed).toEqual([])
  })

  it('reports after column order (then before-only keys)', () => {
    const b = [{ id: 1, x: 1, y: 2 }]
    const a = [{ id: 1, y: 9, x: 3 }]
    const d = diffRows(b, a, 'id')
    const keys = [...d.cellChanges.get(1)!.keys()]
    expect(keys).toEqual(['y', 'x'])
  })

  it('a key dropped from after reads as changed to undefined', () => {
    const b = [{ id: 1, x: 1 }]
    const a = [{ id: 1 }]
    const d = diffRows(b, a, 'id')
    expect(d.changed).toEqual([1])
    expect(d.cellChanges.get(1)!.get('x')).toEqual({ key: 'x', oldValue: 1, newValue: undefined })
  })

  it('a key added to after reads as changed from undefined', () => {
    const b = [{ id: 1 }]
    const a = [{ id: 1, x: 1 }]
    const d = diffRows(b, a, 'id')
    expect(d.changed).toEqual([1])
    expect(d.cellChanges.get(1)!.get('x')).toEqual({ key: 'x', oldValue: undefined, newValue: 1 })
  })

  it('agreed undefined values are not changes', () => {
    const b = [{ id: 1, x: undefined }] as unknown as Row[]
    const a = [{ id: 1, x: undefined }] as unknown as Row[]
    expect(diffRows(b, a, 'id').changed).toEqual([])
  })

  it('skips rows with null/undefined keys', () => {
    const b = [
      { id: 1, v: 1 },
      { id: undefined, v: 2 },
      { id: null, v: 3 },
    ] as unknown as Row[]
    const a = [
      { id: 1, v: 1 },
      { id: undefined, v: 9 },
    ] as unknown as Row[]
    const d = diffRows(b, a, 'id')
    expect(d.status.size).toBe(0)
  })

  it('string and number keys stay distinct', () => {
    const b = [
      { id: 1, v: 1 },
      { id: '1', v: 1 },
    ] as unknown as Row[]
    const a = [
      { id: 1, v: 2 },
      { id: '1', v: 2 },
    ] as unknown as Row[]
    const d = diffRows(b, a, 'id')
    expect(d.changed).toEqual([1, '1'])
    expect(d.status.get(1)).toBe('changed')
    expect(d.status.get('1')).toBe('changed')
  })

  it('maps give O(1)-shaped lookups only for rows present', () => {
    const d = diffRows(before, after, 'id')
    expect(d.status.has(2)).toBe(true)
    expect(d.cellChanges.has(2)).toBe(true)
    expect(d.cellChanges.has(1)).toBe(false)
    expect(d.cellChanges.has(4)).toBe(false)
    expect(d.cellChanges.has(3)).toBe(false)
  })

  it('only changed rows carry cellChanges; added/removed carry none', () => {
    const d = diffRows(before, after, 'id')
    expect(d.cellChanges.get(1)).toBeUndefined()
    expect(d.cellChanges.get(4)).toBeUndefined()
  })

  it('multiple changed columns on one row are all reported', () => {
    const b = [{ id: 1, name: 'A', age: 10, city: 'X' }]
    const a = [{ id: 1, name: 'Z', age: 11, city: 'X' }]
    const d = diffRows(b, a, 'id')
    expect(d.changed).toEqual([1])
    expect([...d.cellChanges.get(1)!.keys()]).toEqual(['name', 'age'])
  })

  it('is a pure function — inputs are never mutated', () => {
    const b = structuredClone(before)
    const a = structuredClone(after)
    diffRows(before, after, 'id')
    expect(before).toEqual(b)
    expect(after).toEqual(a)
  })

  it('returned maps are live-safe snapshots of the caller data', () => {
    const d: RowDiff = diffRows(before, after, 'id')
    const change = d.cellChanges.get(2)!.get('age') as RowDiffCellChange
    expect(change).toEqual({ key: 'age', oldValue: 20, newValue: 21 })
  })
})
