import { describe, it, expect, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import type { IrisTableColumn, IrisTableSortState } from './types'
import { useTableSort } from './useTableSort'

interface TestRow {
  id: number
  name: string
  age: number
}

const columns: IrisTableColumn<TestRow>[] = [
  { key: 'name', title: 'Name', sortable: true },
  { key: 'age', title: 'Age', sortable: true, sorter: (a, b) => a.age - b.age },
  { key: 'id', title: 'ID', sortable: false },
]

const data: TestRow[] = [
  { id: 3, name: 'Charlie', age: 30 },
  { id: 1, name: 'Alice', age: 25 },
  { id: 2, name: 'Bob', age: 35 },
]

describe('useTableSort', () => {
  it('returns unsorted data when no sort is active', () => {
    const { result } = renderHook(() => useTableSort(data, { leafColumns: columns }))
    expect(result.current.sortState).toBeNull()
    expect(result.current.sortComparator).toBeNull()
    expect(result.current.sortedData).toEqual(data)
  })

  it('sorts ascending by a column', () => {
    const { result } = renderHook(() =>
      useTableSort(data, { leafColumns: columns, defaultSort: { key: 'name', direction: 'asc' } }),
    )
    expect(result.current.sortState).toEqual({ key: 'name', direction: 'asc' })
    expect(result.current.sortedData.map((r) => r.name)).toEqual(['Alice', 'Bob', 'Charlie'])
  })

  it('sorts descending by a column', () => {
    const { result } = renderHook(() =>
      useTableSort(data, { leafColumns: columns, defaultSort: { key: 'name', direction: 'desc' } }),
    )
    expect(result.current.sortState).toEqual({ key: 'name', direction: 'desc' })
    expect(result.current.sortedData.map((r) => r.name)).toEqual(['Charlie', 'Bob', 'Alice'])
  })

  it('uses custom sorter when provided', () => {
    const { result } = renderHook(() =>
      useTableSort(data, { leafColumns: columns, defaultSort: { key: 'age', direction: 'asc' } }),
    )
    expect(result.current.sortedData.map((r) => r.age)).toEqual([25, 30, 35])
  })

  it('cycles sort: none → asc → desc → none', () => {
    const { result } = renderHook(() => useTableSort(data, { leafColumns: columns }))

    // No sort initially
    expect(result.current.sortState).toBeNull()

    // First cycle sets asc
    act(() => {
      result.current.cycleSort(columns[0])
    })
    expect(result.current.sortState).toEqual({ key: 'name', direction: 'asc' })

    // Second cycle sets desc
    act(() => {
      result.current.cycleSort(columns[0])
    })
    expect(result.current.sortState).toEqual({ key: 'name', direction: 'desc' })

    // Third cycle clears sort
    act(() => {
      result.current.cycleSort(columns[0])
    })
    expect(result.current.sortState).toBeNull()
  })

  it('does not cycle sort on non-sortable column', () => {
    const { result } = renderHook(() => useTableSort(data, { leafColumns: columns }))
    act(() => {
      result.current.cycleSort(columns[2])
    }) // id column, sortable=false
    expect(result.current.sortState).toBeNull()
  })

  it('switches sort column on second cycle call', () => {
    const { result } = renderHook(() => useTableSort(data, { leafColumns: columns }))
    act(() => {
      result.current.cycleSort(columns[0])
    }) // name asc
    expect(result.current.sortState).toEqual({ key: 'name', direction: 'asc' })

    act(() => {
      result.current.cycleSort(columns[1])
    }) // age asc (new column resets to asc)
    expect(result.current.sortState).toEqual({ key: 'age', direction: 'asc' })
  })

  it('respects controlled sort prop', () => {
    const { result, rerender } = renderHook(
      ({ sort }: { sort?: { key: string; direction: string } | null }) =>
        useTableSort(data, {
          leafColumns: columns,
          sort: sort as { key: string; direction: 'asc' | 'desc' } | null | undefined,
        }),
      { initialProps: { sort: { key: 'name', direction: 'asc' } } },
    )
    expect(result.current.sortState).toEqual({ key: 'name', direction: 'asc' })

    // Update controlled sort via rerender
    rerender({ sort: { key: 'name', direction: 'desc' } })
    expect(result.current.sortState).toEqual({ key: 'name', direction: 'desc' })
  })

  it('handles empty data', () => {
    const { result } = renderHook(() => useTableSort<TestRow>([], { leafColumns: [] }))
    expect(result.current.sortedData).toEqual([])
    expect(result.current.sortState).toBeNull()
  })

  it('falls back to default value-based comparator when column has no sorter', () => {
    const { result } = renderHook(() =>
      useTableSort(data, { leafColumns: columns, defaultSort: { key: 'id', direction: 'asc' } }),
    )
    // id column has no custom sorter but exists — falls back to compareValues
    expect(result.current.sortComparator).not.toBeNull()
    expect(result.current.sortedData.map((r) => r.id)).toEqual([1, 2, 3])
  })

  // ── Multi-column mode (vxe sort-config.multiple parity, batch F) ──────

  it('multi: appends columns in click order (most-significant first)', () => {
    const { result } = renderHook(() =>
      useTableSort(data, { leafColumns: columns, multiSort: true }),
    )
    act(() => {
      result.current.cycleMultiSort(columns[0]) // name asc
    })
    act(() => {
      result.current.cycleMultiSort(columns[1]) // age asc appended
    })
    expect(result.current.multiSortState).toEqual([
      { key: 'name', direction: 'asc' },
      { key: 'age', direction: 'asc' },
    ])
  })

  it('multi: cycles asc → desc → remove for an existing column, append restarts at asc', () => {
    const { result } = renderHook(() =>
      useTableSort(data, { leafColumns: columns, multiSort: true }),
    )
    act(() => {
      result.current.cycleMultiSort(columns[0])
    })
    expect(result.current.multiSortState).toEqual([{ key: 'name', direction: 'asc' }])
    act(() => {
      result.current.cycleMultiSort(columns[0])
    })
    expect(result.current.multiSortState).toEqual([{ key: 'name', direction: 'desc' }])
    act(() => {
      result.current.cycleMultiSort(columns[0])
    })
    expect(result.current.multiSortState).toEqual([])
    // Re-appending a removed column starts at asc again
    act(() => {
      result.current.cycleMultiSort(columns[0])
    })
    expect(result.current.multiSortState).toEqual([{ key: 'name', direction: 'asc' }])
  })

  it('multi: comparator precedence — first non-zero comparison wins (stable ties)', () => {
    const tieData: TestRow[] = [
      { id: 1, name: 'Alice', age: 30 },
      { id: 2, name: 'Bob', age: 35 },
      { id: 3, name: 'Alice', age: 25 },
    ]
    const { result } = renderHook(() =>
      useTableSort(tieData, {
        leafColumns: columns,
        multiSort: true,
        defaultMultiSort: [
          { key: 'name', direction: 'asc' },
          { key: 'age', direction: 'asc' },
        ],
      }),
    )
    // name asc first: Alice(25), Alice(30), then Bob — age breaks the Alice tie
    expect(result.current.sortedData.map((r) => r.id)).toEqual([3, 1, 2])
  })

  it('multi: desc flips the direction of that column only', () => {
    const tieData: TestRow[] = [
      { id: 1, name: 'Alice', age: 30 },
      { id: 2, name: 'Bob', age: 35 },
      { id: 3, name: 'Alice', age: 25 },
    ]
    const { result } = renderHook(() =>
      useTableSort(tieData, {
        leafColumns: columns,
        multiSort: true,
        defaultMultiSort: [
          { key: 'name', direction: 'asc' },
          { key: 'age', direction: 'desc' },
        ],
      }),
    )
    expect(result.current.sortedData.map((r) => r.id)).toEqual([1, 3, 2])
  })

  it('multi: respects controlled multiSortState and fires onMultiSortChange', () => {
    const onMulti = vi.fn()
    const { result, rerender } = renderHook(
      ({ ms }: { ms: IrisTableSortState[] }) =>
        useTableSort(data, {
          leafColumns: columns,
          multiSort: true,
          multiSortState: ms,
          onMultiSortChange: onMulti,
        }),
      { initialProps: { ms: [{ key: 'name', direction: 'asc' }] } },
    )
    expect(result.current.multiSortState).toEqual([{ key: 'name', direction: 'asc' }])
    // Controlled: the emitted next value is computed from the prop, but the
    // displayed state only changes when the parent writes back.
    act(() => {
      result.current.cycleMultiSort(columns[1])
    })
    expect(onMulti).toHaveBeenLastCalledWith([
      { key: 'name', direction: 'asc' },
      { key: 'age', direction: 'asc' },
    ])
    expect(result.current.multiSortState).toEqual([{ key: 'name', direction: 'asc' }])
    rerender({
      ms: [
        { key: 'name', direction: 'asc' },
        { key: 'age', direction: 'asc' },
      ],
    })
    expect(result.current.multiSortState).toEqual([
      { key: 'name', direction: 'asc' },
      { key: 'age', direction: 'asc' },
    ])
  })

  it('multi: does not cycle a non-sortable column', () => {
    const { result } = renderHook(() =>
      useTableSort(data, { leafColumns: columns, multiSort: true }),
    )
    act(() => {
      result.current.cycleMultiSort(columns[2]) // id, sortable=false
    })
    expect(result.current.multiSortState).toEqual([])
    expect(result.current.sortedData).toEqual(data)
  })
})
