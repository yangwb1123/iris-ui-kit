import { describe, expect, it, vi } from 'vitest'
import {
  createTableMultiSortComparator,
  createTableSortComparator,
  resolveTableSortInfo,
  sortTableRows,
} from './table-sort'

type Row = { id: number; name: string; score: string | number | null; group: string }
type Column = {
  key: string
  sortType?: 'number' | 'string' | 'auto'
  sorter?: (a: Row, b: Row) => number
}

const columns: Column[] = [{ key: 'name' }, { key: 'score', sortType: 'number' }, { key: 'group' }]
const valueOf = (row: Row, column: Column): unknown => row[column.key as keyof Row]

describe('table sorting projection', () => {
  it('resolves single-column header state', () => {
    expect(
      resolveTableSortInfo('name', {
        multiSort: false,
        sort: { key: 'name', direction: 'asc' },
      }),
    ).toEqual({ isActive: true, direction: 'asc', multiIndex: -1 })
    expect(
      resolveTableSortInfo('score', {
        multiSort: false,
        sort: { key: 'name', direction: 'asc' },
      }),
    ).toEqual({ isActive: false, direction: null, multiIndex: -1 })
  })

  it('resolves multi-sort direction and zero-based sequence', () => {
    const sorts = [
      { key: 'group', direction: 'asc' as const },
      { key: 'score', direction: 'desc' as const },
    ]
    expect(resolveTableSortInfo('score', { multiSort: true, multiSortState: sorts })).toEqual({
      isActive: true,
      direction: 'desc',
      multiIndex: 1,
    })
    expect(resolveTableSortInfo('name', { multiSort: true, multiSortState: sorts })).toEqual({
      isActive: false,
      direction: null,
      multiIndex: -1,
    })
  })

  it('builds a direction-aware comparator with typed values', () => {
    const asc = createTableSortComparator({ key: 'score', direction: 'asc' }, columns, valueOf)
    const desc = createTableSortComparator({ key: 'score', direction: 'desc' }, columns, valueOf)
    expect(
      asc?.(
        { id: 1, name: 'a', score: '10', group: 'x' },
        { id: 2, name: 'b', score: 2, group: 'x' },
      ),
    ).toBeGreaterThan(0)
    expect(
      desc?.(
        { id: 1, name: 'a', score: '10', group: 'x' },
        { id: 2, name: 'b', score: 2, group: 'x' },
      ),
    ).toBeLessThan(0)
  })

  it('keeps null first for number sorts instead of coercing null to zero', () => {
    const rows: Row[] = [
      { id: 1, name: 'zero', score: 0, group: 'x' },
      { id: 2, name: 'null', score: null, group: 'x' },
      { id: 3, name: 'one', score: 1, group: 'x' },
    ]
    expect(
      sortTableRows(rows, columns, {
        sort: { key: 'score', direction: 'asc' },
        getValue: valueOf,
      }).map((row) => row.id),
    ).toEqual([2, 1, 3])
    expect(
      sortTableRows(rows, columns, {
        sort: { key: 'score', direction: 'desc' },
        getValue: valueOf,
      }).map((row) => row.id),
    ).toEqual([3, 1, 2])
  })

  it('falls back safely for invalid numeric values while retaining numeric strings', () => {
    const rows: Row[] = [
      { id: 1, name: 'invalid', score: 'not-a-number', group: 'x' },
      { id: 2, name: 'two', score: '2', group: 'x' },
      { id: 3, name: 'zero', score: 0, group: 'x' },
    ]
    expect(
      sortTableRows(rows, columns, {
        sort: { key: 'score', direction: 'asc' },
        getValue: valueOf,
      }).map((row) => row.id),
    ).toEqual([3, 2, 1])
  })

  it('orders NaN and infinities deterministically and keeps equal infinities stable', () => {
    const data: Row[] = [
      { id: 1, name: 'nan', score: Number.NaN, group: 'x' },
      { id: 2, name: 'positive infinity', score: Number.POSITIVE_INFINITY, group: 'x' },
      { id: 3, name: 'one', score: 1, group: 'x' },
      { id: 4, name: 'second positive infinity', score: Number.POSITIVE_INFINITY, group: 'x' },
      { id: 5, name: 'negative infinity', score: Number.NEGATIVE_INFINITY, group: 'x' },
    ]
    expect(
      sortTableRows(data, columns, {
        sort: { key: 'score', direction: 'asc' },
        getValue: valueOf,
      }).map((row) => row.id),
    ).toEqual([5, 3, 2, 4, 1])
    expect(
      sortTableRows(data, columns, {
        sort: { key: 'score', direction: 'desc' },
        getValue: valueOf,
      }).map((row) => row.id),
    ).toEqual([1, 2, 4, 3, 5])
  })

  it('sorts date-like values without changing the resolver contract', () => {
    const dateRows = [
      { id: 1, date: new Date('2024-02-01') },
      { id: 2, date: new Date('2024-01-01') },
    ]
    const dateColumn: Column = { key: 'date' }
    expect(
      sortTableRows(dateRows, [dateColumn], {
        sort: { key: 'date', direction: 'asc' },
        getValue: (row) => row.date,
      }).map((row) => row.id),
    ).toEqual([2, 1])
  })

  it('keeps custom sorters authoritative and skips unknown single keys', () => {
    const sorter = vi.fn((a: Row, b: Row) => a.id - b.id)
    const customColumns: Column[] = [{ key: 'name', sorter }]
    const comparator = createTableSortComparator(
      { key: 'name', direction: 'desc' },
      customColumns,
      valueOf,
    )
    expect(
      comparator?.(
        { id: 1, name: 'a', score: 0, group: 'x' },
        { id: 2, name: 'b', score: 0, group: 'x' },
      ),
    ).toBeGreaterThan(0)
    expect(sorter).toHaveBeenCalled()
    expect(
      createTableSortComparator({ key: 'missing', direction: 'asc' }, columns, valueOf),
    ).toBeNull()
  })

  it('chains multi-column sorts in declared order and ignores missing columns', () => {
    const comparator = createTableMultiSortComparator(
      [
        { key: 'missing', direction: 'asc' },
        { key: 'group', direction: 'asc' },
        { key: 'score', direction: 'desc' },
      ],
      columns,
      valueOf,
    )
    const first = { id: 1, name: 'a', score: 2, group: 'x' }
    const second = { id: 2, name: 'b', score: 10, group: 'x' }
    const third = { id: 3, name: 'c', score: 99, group: 'y' }
    expect([third, first, second].sort(comparator!)).toEqual([second, first, third])
  })

  it('ignores malformed runtime sort state and columns', () => {
    const rows: Row[] = [{ id: 1, name: 'a', score: 1, group: 'x' }]
    expect(
      sortTableRows(rows, [null, { key: 'score' }] as unknown as Column[], {
        sort: { key: 'score', direction: 'invalid' } as unknown as {
          key: string
          direction: 'asc'
        },
        getValue: valueOf,
      }),
    ).toBe(rows)
    expect(
      sortTableRows(rows, columns, {
        mode: 'multiple',
        multiSort: [null, { key: 'missing', direction: 'asc' }].map(
          (value) => value as unknown as { key: string; direction: 'asc' },
        ),
        getValue: valueOf,
      }),
    ).toBe(rows)
  })

  it('returns the original rows when no usable sort is active', () => {
    const rows: Row[] = [{ id: 1, name: 'a', score: 1, group: 'x' }]
    expect(sortTableRows(rows, columns, { getValue: valueOf })).toBe(rows)
    expect(
      sortTableRows(rows, columns, {
        mode: 'multiple',
        multiSort: [{ key: 'missing', direction: 'asc' }],
        getValue: valueOf,
      }),
    ).toBe(rows)
  })

  it('sorts a copied array and does not mutate the source', () => {
    const rows: Row[] = [
      { id: 2, name: 'b', score: 2, group: 'x' },
      { id: 1, name: 'a', score: 1, group: 'x' },
    ]
    const sorted = sortTableRows(rows, columns, {
      sort: { key: 'score', direction: 'asc' },
      getValue: valueOf,
    })
    expect(sorted.map((row) => row.id)).toEqual([1, 2])
    expect(rows.map((row) => row.id)).toEqual([2, 1])
  })
})
