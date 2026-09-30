import * as React from 'react'
import { act, render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import {
  GRID_FILTERING_CHANGE_EVENT,
  GRID_SORTING_CHANGE_EVENT,
  type GridCore,
  type GridFilterValues,
  type SortState,
} from '@iris-ui-kit/core/grid'
import { useGridCore } from './useGridCore'
import { useGridFiltering } from './useGridFiltering'
import { useGridSorting } from './useGridSorting'

describe('controlled sort and filter synchronization', () => {
  it('reconciles stable in-place prop mutations after an unrelated rerender', () => {
    const sort: SortState = { key: 'name', direction: 'asc' }
    const multiSortState: SortState[] = [{ key: 'priority', direction: 'asc' }]
    const filters = { status: 'active' }
    const filterValues: GridFilterValues = { status: ['active'] }
    const originalReferences = { sort, multiSortState, filters, filterValues }
    const onSortChange = vi.fn()
    const onMultiSortChange = vi.fn()
    const onFiltersChange = vi.fn()
    const onFilterValuesChange = vi.fn()
    const sortingEvent = vi.fn()
    const filteringEvent = vi.fn()
    let forceRerender!: () => void
    let core!: GridCore
    let sorting!: ReturnType<typeof useGridSorting>
    let filtering!: ReturnType<typeof useGridFiltering>

    function Harness() {
      const [, setTick] = React.useState(0)
      forceRerender = () => setTick((tick) => tick + 1)
      core = useGridCore()
      sorting = useGridSorting(core, [], {
        leafColumns: [
          { key: 'name', sortable: true },
          { key: 'priority', sortable: true },
        ],
        sort,
        multiSort: true,
        multiSortState,
        onSortChange,
        onMultiSortChange,
      })
      filtering = useGridFiltering(core, [{ status: 'active' }], {
        columns: [{ key: 'status' }],
        getValue: (row, column) => row[column.key],
        filters,
        filterValues,
        onFiltersChange,
        onFilterValuesChange,
      })
      return null
    }

    const view = render(<Harness />)
    const unsubscribeSorting = core.on(GRID_SORTING_CHANGE_EVENT, sortingEvent)
    const unsubscribeFiltering = core.on(GRID_FILTERING_CHANGE_EVENT, filteringEvent)
    onSortChange.mockClear()
    onMultiSortChange.mockClear()
    onFiltersChange.mockClear()
    onFilterValuesChange.mockClear()

    sort.direction = 'desc'
    multiSortState[0]!.direction = 'desc'
    filters.status = 'paused'
    filterValues.status!.push('pending')

    act(() => forceRerender())

    expect(sort).toBe(originalReferences.sort)
    expect(multiSortState).toBe(originalReferences.multiSortState)
    expect(filters).toBe(originalReferences.filters)
    expect(filterValues).toBe(originalReferences.filterValues)
    expect(sorting.sortState).toEqual(sorting.model.get().sort)
    expect(sorting.multiSortState).toEqual(sorting.model.get().multiSort)
    expect(filtering.filters).toEqual(filtering.model.get().filters)
    expect(filtering.filterValues).toEqual(filtering.model.get().filterValues)
    expect(sorting.model.get().sort).toEqual({ key: 'name', direction: 'desc' })
    expect(sorting.model.get().multiSort).toEqual([{ key: 'priority', direction: 'desc' }])
    expect(filtering.model.get().filters).toEqual({ status: 'paused' })
    expect(filtering.model.get().filterValues).toEqual({ status: ['active', 'pending'] })
    expect(onSortChange).not.toHaveBeenCalled()
    expect(onMultiSortChange).not.toHaveBeenCalled()
    expect(onFiltersChange).not.toHaveBeenCalled()
    expect(onFilterValuesChange).not.toHaveBeenCalled()
    expect(sortingEvent).not.toHaveBeenCalled()
    expect(filteringEvent).not.toHaveBeenCalled()

    unsubscribeSorting()
    unsubscribeFiltering()
    view.unmount()
  })
})
