import { describe, expect, it } from 'vitest'
import {
  cloneRowInList,
  insertRowInList,
  resolveTableRowKey,
  removeRowFromList,
  removeRowsFromList,
  reorderRowsInList,
  reorderRowsInListAt,
  resolveRowDragProjection,
  updateRowInList,
} from './table-rows'

interface Row extends Record<string, unknown> {
  id: number
  name: string
}

const rows: Row[] = [
  { id: 1, name: 'Alice' },
  { id: 2, name: 'Bob' },
  { id: 3, name: 'Charlie' },
]

describe('resolveTableRowKey', () => {
  it('returns string and numeric field values, including empty, zero, NaN, and Infinity', () => {
    expect(resolveTableRowKey({ key: 'alpha' }, 'key', 9)).toBe('alpha')
    expect(resolveTableRowKey({ key: '' }, 'key', 9)).toBe('')
    expect(resolveTableRowKey({ key: 0 }, 'key', 9)).toBe(0)
    expect(Object.is(resolveTableRowKey({ key: -0 }, 'key', 9), -0)).toBe(true)
    expect(Number.isNaN(resolveTableRowKey({ key: Number.NaN }, 'key', 9))).toBe(true)
    expect(resolveTableRowKey({ key: Number.POSITIVE_INFINITY }, 'key', 9)).toBe(
      Number.POSITIVE_INFINITY,
    )
  })

  it('falls back to the index for missing and null values without mutating the row', () => {
    const missing = { label: 'missing' }
    const nulled = { key: null, label: 'null' }
    expect(resolveTableRowKey(missing, 'key', 2)).toBe(2)
    expect(resolveTableRowKey(nulled, 'key', 3)).toBe(3)
    expect(missing).toEqual({ label: 'missing' })
    expect(nulled).toEqual({ key: null, label: 'null' })
  })
})

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

  it('clamps out-of-range indexes to the ends and rejects NaN', () => {
    expect(insertRowInList(rows, 'id', { id: 9, name: 'Zoe' }, -5).map((r) => r.id)).toEqual([
      9, 1, 2, 3,
    ])
    expect(insertRowInList(rows, 'id', { id: 9, name: 'Zoe' }, 99).map((r) => r.id)).toEqual([
      1, 2, 3, 9,
    ])
    expect(insertRowInList(rows, 'id', { id: 9, name: 'Zoe' }, 1.9).map((r) => r.id)).toEqual([
      1, 9, 2, 3,
    ])
    expect(insertRowInList(rows, 'id', { id: 9, name: 'Zoe' }, Number.NaN)).toBe(rows)
  })

  it('auto-ids a key-less row with max+1 (1 on an empty list)', () => {
    const next = insertRowInList(rows, 'id', { name: 'Dave' } as Row)
    expect(next[3]?.id).toBe(4)
    expect(insertRowInList([], 'id', { name: 'Solo' } as Row)[0]).toEqual({ id: 1, name: 'Solo' })
  })

  it('avoids an overflow auto-id collision', () => {
    const overflow = [
      { id: Number.MAX_VALUE, name: 'max' },
      { id: Infinity, name: 'inf' },
    ]
    const next = insertRowInList(overflow, 'id', { name: 'new' } as Row)
    expect(next[2]?.id).toBe(1)
    expect(new Set(next.map((row) => row.id)).size).toBe(3)
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

describe('NaN row keys', () => {
  it('can address NaN without changing ordinary 0/-0 key equivalence', () => {
    const keyed = [
      { id: Number.NaN, name: 'nan' },
      { id: 0, name: 'zero' },
    ]
    const updated = updateRowInList(keyed, 'id', Number.NaN, { name: 'updated' })
    expect(updated[0]).toEqual({ id: Number.NaN, name: 'updated' })
    expect(removeRowFromList(updated, 'id', Number.NaN).map((row) => row.id)).toEqual([0])
    expect(reorderRowsInList(updated, (row) => row.id, Number.NaN, 0).map((row) => row.id)).toEqual(
      [0, Number.NaN],
    )
  })

  it('rejects malformed patches without changing the list', () => {
    expect(updateRowInList(rows, 'id', 1, null as never)).toBe(rows)
    expect(updateRowInList(rows, 'id', 1, [] as never)).toBe(rows)
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

describe('removeRowsFromList', () => {
  it('removes present keys, skips missing keys, and reports only actual removals', () => {
    const rows = [{ id: 1 }, { id: 2 }, { id: 3 }]
    const result = removeRowsFromList(rows, 'id', [2, 99, 3])
    expect(result.rows).toEqual([{ id: 1 }])
    expect(result.removedKeys).toEqual(new Set([2, 3]))
  })

  it('returns the original row reference when every key is missing', () => {
    const rows = [{ id: 1 }]
    const result = removeRowsFromList(rows, 'id', [9])
    expect(result.rows).toBe(rows)
    expect(result.removedKeys.size).toBe(0)
  })
})

describe('resolveRowDragProjection', () => {
  it('keeps visible indexes, source row identity, and computed keys together', () => {
    const visible = [rows[2]!, rows[0]!, rows[1]!]
    const result = resolveRowDragProjection(
      visible,
      'row:0',
      'row:2',
      (row, index) => `row:${row.id}:${index}`,
    )
    expect(result.fromIndex).toBe(-1)
    expect(result.toIndex).toBe(-1)
    expect(result.fromRow).toBeUndefined()
    expect(result.toRow).toBeUndefined()

    const resolved = resolveRowDragProjection(
      visible,
      'row:3:0',
      'row:2:2',
      (row, index) => `row:${row.id}:${index}`,
    )
    expect(resolved.fromIndex).toBe(0)
    expect(resolved.toIndex).toBe(2)
    expect(resolved.fromRow).toBe(rows[2])
    expect(resolved.toRow).toBe(rows[1])
    expect(resolved.fromKey).toBe('row:3:0')
    expect(resolved.toKey).toBe('row:2:2')
  })

  it('fails closed for missing drag targets', () => {
    const result = resolveRowDragProjection(rows, 'missing', '3', (row) => row.id)
    expect(result.fromIndex).toBe(-1)
    expect(result.toIndex).toBe(2)
    expect(result.fromRow).toBeUndefined()
    expect(result.toRow).toBe(rows[2])
    expect(result.fromKey).toBeUndefined()
    expect(result.toKey).toBe(3)
  })
})

describe('reorderRowsInList', () => {
  const keyOf = (row: Row): number => row.id

  it('uses auto remove-then-insert semantics and keeps row identity', () => {
    const next = reorderRowsInList(rows, keyOf, 1, 3)
    expect(next.map((row) => row.id)).toEqual([2, 3, 1])
    expect(next[0]).toBe(rows[1])
    expect(next[2]).toBe(rows[0])
    expect(rows.map((row) => row.id)).toEqual([1, 2, 3])
  })

  it('supports before and after placement in either direction', () => {
    expect(reorderRowsInList(rows, keyOf, 1, 3, 'before').map((row) => row.id)).toEqual([2, 1, 3])
    expect(reorderRowsInList(rows, keyOf, 3, 1, 'after').map((row) => row.id)).toEqual([1, 3, 2])
  })

  it('returns the original list for missing or same keys', () => {
    expect(reorderRowsInList(rows, keyOf, 9, 3)).toBe(rows)
    expect(reorderRowsInList(rows, keyOf, 2, 2)).toBe(rows)
  })

  it('resolves computed keys against the original sibling indexes', () => {
    const indexed = rows.map((row) => ({ ...row, code: `${row.name}:${row.id}` }))
    const next = reorderRowsInList(
      indexed,
      (row, index) => `${row.code}:${index}`,
      'Bob:2:1',
      'Charlie:3:2',
    )
    expect(next.map((row) => row.id)).toEqual([1, 3, 2])
  })
})

describe('reorderRowsInListAt', () => {
  const keyOf = (row: Row): number => row.id

  it('keeps insertion indexes in original-list space', () => {
    expect(reorderRowsInListAt(rows, keyOf, 1, 1).map((row) => row.id)).toEqual([2, 1, 3])
    expect(reorderRowsInListAt(rows, keyOf, 1, 3).map((row) => row.id)).toEqual([2, 3, 1])
    expect(reorderRowsInListAt(rows, keyOf, 3, 1).map((row) => row.id)).toEqual([1, 3, 2])
  })

  it('returns the original list for invalid or identity-only moves', () => {
    expect(reorderRowsInListAt(rows, keyOf, 9, 1)).toBe(rows)
    expect(reorderRowsInListAt(rows, keyOf, 2, 1)).toBe(rows)
    expect(reorderRowsInListAt(rows, keyOf, 3, Number.NaN)).toBe(rows)
  })
})

describe('cloneRowInList', () => {
  it('clones ALL field values with a fresh auto id, inserted right after the source', () => {
    const next = cloneRowInList(rows, 'id', 2)
    expect(next.map((r) => r.id)).toEqual([1, 2, 4, 3])
    expect(next[2]).toEqual({ id: 4, name: 'Bob' }) // 克隆内容 = 源行全部字段
    expect(next[2]).not.toBe(rows[1]) // 新对象
    expect(rows).toEqual([
      { id: 1, name: 'Alice' },
      { id: 2, name: 'Bob' },
      { id: 3, name: 'Charlie' },
    ])
  })

  it('clone of the last row appends at the end (sourceIndex + 1)', () => {
    const next = cloneRowInList(rows, 'id', 3)
    expect(next.map((r) => r.id)).toEqual([1, 2, 3, 4])
    expect(next[3]).toEqual({ id: 4, name: 'Charlie' })
  })

  it('clone of the FIRST row inserts at index 1 (right after the source)', () => {
    const next = cloneRowInList(rows, 'id', 1)
    expect(next.map((r) => r.id)).toEqual([1, 4, 2, 3])
    expect(next[1]).toEqual({ id: 4, name: 'Alice' })
  })

  it('explicit index inserts the clone there (before the source works)', () => {
    const next = cloneRowInList(rows, 'id', 2, 0)
    expect(next.map((r) => r.id)).toEqual([4, 1, 2, 3])
    expect(next[0]).toEqual({ id: 4, name: 'Bob' })
    const mid = cloneRowInList(rows, 'id', 1, 3)
    expect(mid.map((r) => r.id)).toEqual([1, 2, 3, 4])
    expect(mid[3]).toEqual({ id: 4, name: 'Alice' })
  })

  it('clamps out-of-range indexes to the ends', () => {
    expect(cloneRowInList(rows, 'id', 2, -5).map((r) => r.id)).toEqual([4, 1, 2, 3])
    expect(cloneRowInList(rows, 'id', 2, 99).map((r) => r.id)).toEqual([1, 2, 3, 4])
  })

  it('missing key returns the ORIGINAL reference (silent no-op)', () => {
    expect(cloneRowInList(rows, 'id', 99)).toBe(rows)
    const empty: Row[] = []
    expect(cloneRowInList(empty, 'id', 1)).toBe(empty) // 空列表同样原引用
  })

  it('keeps every other row object by identity', () => {
    const next = cloneRowInList(rows, 'id', 2)
    expect(next[0]).toBe(rows[0])
    expect(next[1]).toBe(rows[1])
    expect(next[3]).toBe(rows[2])
    expect(next).not.toBe(rows)
  })

  it('clone key is unique even when a string key is cloned (numeric auto id, 1 when none)', () => {
    const stringKeyed = [
      { id: 'a', name: 'x' },
      { id: 'b', name: 'y' },
    ] as Row[]
    const next = cloneRowInList(stringKeyed, 'id', 'a')
    // 字符串 key 不参与 numeric max → auto id 从 1 起
    expect(next[1]?.id).toBe(1)
    expect(next[1]).toEqual({ id: 1, name: 'x' })
    expect(next[0]).toBe(stringKeyed[0]) // 源行不动
  })

  it('clone id = max numeric key + 1 even when the source is NOT the max', () => {
    const mixed = [
      { id: 1, name: 'a' },
      { id: 7, name: 'b' },
    ] as Row[]
    const next = cloneRowInList(mixed, 'id', 1)
    expect(next[1]?.id).toBe(8)
    expect(next[1]).toEqual({ id: 8, name: 'a' })
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
