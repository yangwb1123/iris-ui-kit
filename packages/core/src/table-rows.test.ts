import { describe, expect, it } from 'vitest'
import { insertRowInList, removeRowFromList, updateRowInList } from './table-rows'

interface Row extends Record<string, unknown> {
  id: number
  name: string
}

const rows: Row[] = [
  { id: 1, name: 'Alice' },
  { id: 2, name: 'Bob' },
  { id: 3, name: 'Charlie' },
]

describe('insertRowInList', () => {
  it('inserts at the end by default and never mutates the input', () => {
    const next = insertRowInList(rows, 'id', { id: 4, name: 'Dave' })
    expect(next.map((r) => r.id)).toEqual([1, 2, 3, 4])
    expect(next[3]).toEqual({ id: 4, name: 'Dave' })
    expect(rows).toEqual([
      { id: 1, name: 'Alice' },
      { id: 2, name: 'Bob' },
      { id: 3, name: 'Charlie' },
    ])
    expect(next).not.toBe(rows)
    expect(next.slice(0, 3)).toEqual(rows)
  })

  it('inserts at a given index (middle), shifting the rest', () => {
    const next = insertRowInList(rows, 'id', { id: 9, name: 'Zoe' }, 1)
    expect(next.map((r) => r.id)).toEqual([1, 9, 2, 3])
    expect(next[0]).toBe(rows[0])
    expect(next[2]).toBe(rows[1])
  })

  it('clamps out-of-range indexes to the ends', () => {
    expect(insertRowInList(rows, 'id', { id: 9, name: 'Zoe' }, -5).map((r) => r.id)).toEqual([
      9, 1, 2, 3,
    ])
    expect(insertRowInList(rows, 'id', { id: 9, name: 'Zoe' }, 99).map((r) => r.id)).toEqual([
      1, 2, 3, 9,
    ])
  })

  it('auto-ids a key-less row with max+1 (1 on an empty list)', () => {
    const next = insertRowInList(rows, 'id', { name: 'Dave' } as Row)
    expect(next[3]?.id).toBe(4)
    expect(insertRowInList([], 'id', { name: 'Solo' } as Row)[0]).toEqual({ id: 1, name: 'Solo' })
  })

  it('auto-id ignores non-numeric keys and writes to a COPY of the input row', () => {
    const stringKeyed = [
      { id: 'a', name: 'x' },
      { id: 'b', name: 'y' },
    ] as Row[]
    const row = { name: 'c' } as Row
    const next = insertRowInList(stringKeyed, 'id', row)
    // 字符串 key 不参与 numeric max → auto id 从 1 起
    expect(next[2]?.id).toBe(1)
    expect(row).toEqual({ name: 'c' }) // input row untouched
    // A key that already exists is preserved verbatim (no auto id).
    const kept = insertRowInList(rows, 'id', { id: 7, name: 'G' })
    expect(kept[3]).toEqual({ id: 7, name: 'G' })
  })
})

describe('removeRowFromList', () => {
  it('filters out the matching row, keeping the rest by reference', () => {
    const next = removeRowFromList(rows, 'id', 2)
    expect(next.map((r) => r.id)).toEqual([1, 3])
    expect(next[0]).toBe(rows[0])
    expect(next[1]).toBe(rows[2])
    expect(rows).toHaveLength(3)
  })

  it('returns the ORIGINAL reference when the key is not found', () => {
    const next = removeRowFromList(rows, 'id', 99)
    expect(next).toBe(rows)
  })

  it('handles an empty list', () => {
    expect(removeRowFromList([], 'id', 1)).toEqual([])
  })
})

describe('updateRowInList', () => {
  it('replaces the matching row with { ...row, ...patch }', () => {
    const next = updateRowInList(rows, 'id', 2, { name: 'Bobby' })
    expect(next.map((r) => r.name)).toEqual(['Alice', 'Bobby', 'Charlie'])
    expect(next[1]).toEqual({ id: 2, name: 'Bobby' })
  })

  it('keeps every other row object by identity', () => {
    const next = updateRowInList(rows, 'id', 2, { name: 'Bobby' })
    expect(next[0]).toBe(rows[0])
    expect(next[2]).toBe(rows[2])
    expect(next).not.toBe(rows)
    expect(rows[1]).toEqual({ id: 2, name: 'Bob' }) // input untouched
  })

  it('returns the ORIGINAL reference when the key is not found', () => {
    const next = updateRowInList(rows, 'id', 99, { name: 'X' })
    expect(next).toBe(rows)
  })
})
