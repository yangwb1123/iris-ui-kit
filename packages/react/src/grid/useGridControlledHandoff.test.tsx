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

describe('controlled composite handoffs', () => {
  it('hides rejected controlled composite proposals and restores accepted snapshots', () => {
    const acceptedMultiSort: SortState[] = [{ key: 'name', direction: 'asc' }]
    const acceptedFilters = { status: 'active' }
    const acceptedFilterValues: GridFilterValues = { status: ['active', 'pending'] }
    const rejectedMultiSort: SortState[] = [{ key: 'age', direction: 'desc' }]
    const rejectedFilters = { status: 'paused' }
    const rejectedFilterValues: GridFilterValues = { status: ['paused'] }
    const onMultiSortChange = vi.fn()
    const onFiltersChange = vi.fn()
    const onFilterValuesChange = vi.fn()
    const sortingEvent = vi.fn()
    const filteringEvent = vi.fn()
    let updateMultiSort!: React.Dispatch<React.SetStateAction<SortState[] | undefined>>
    let updateFilters!: React.Dispatch<React.SetStateAction<Record<string, string> | undefined>>
    let updateFilterValues!: React.Dispatch<React.SetStateAction<GridFilterValues | undefined>>
    let core!: GridCore
    let sorting!: ReturnType<typeof useGridSorting>
    let filtering!: ReturnType<typeof useGridFiltering>

    function Harness() {
      const [multiSortState, setMultiSortState] = React.useState<SortState[] | undefined>(
        acceptedMultiSort,
      )
      const [filters, setFilters] = React.useState<Record<string, string> | undefined>(
        acceptedFilters,
      )
      const [filterValues, setFilterValues] = React.useState<GridFilterValues | undefined>(
        acceptedFilterValues,
      )
      updateMultiSort = setMultiSortState
      updateFilters = setFilters
      updateFilterValues = setFilterValues
      core = useGridCore()
      sorting = useGridSorting(core, [], {
        leafColumns: [],
        multiSort: true,
        multiSortState,
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
    core.on(GRID_SORTING_CHANGE_EVENT, sortingEvent)
    core.on(GRID_FILTERING_CHANGE_EVENT, filteringEvent)

    const sortSnapshot = sorting.multiSortState
    const filtersSnapshot = filtering.filters
    const filterValuesSnapshot = filtering.filterValues
    expect(sortSnapshot).not.toBe(acceptedMultiSort)
    expect(sortSnapshot[0]).not.toBe(acceptedMultiSort[0])
    expect(filtersSnapshot).not.toBe(acceptedFilters)
    expect(filterValuesSnapshot).not.toBe(acceptedFilterValues)
    expect(filterValuesSnapshot.status).not.toBe(acceptedFilterValues.status)

    sortSnapshot.push({ key: 'local', direction: 'desc' })
    sortSnapshot[0]!.direction = 'desc'
    filtersSnapshot.status = 'local'
    filtersSnapshot.extra = 'local'
    filterValuesSnapshot.status!.push('local')
    filterValuesSnapshot.status = ['replacement']
    filterValuesSnapshot.extra = ['local']

    expect(acceptedMultiSort).toEqual([{ key: 'name', direction: 'asc' }])
    expect(acceptedFilters).toEqual({ status: 'active' })
    expect(acceptedFilterValues).toEqual({ status: ['active', 'pending'] })
    expect(sorting.model.get()).toEqual({ sort: null, multiSort: acceptedMultiSort })
    expect(sorting.model.store.getState()).toEqual({ sort: null, multiSort: acceptedMultiSort })
    expect(filtering.model.get()).toEqual({
      filters: acceptedFilters,
      filterValues: acceptedFilterValues,
    })
    expect(filtering.model.store.getState()).toEqual({
      filters: acceptedFilters,
      filterValues: acceptedFilterValues,
    })

    act(() => {
      sorting.model.setMultiSort(rejectedMultiSort)
      filtering.model.setFilters(rejectedFilters)
      filtering.model.setFilterValues(rejectedFilterValues)
    })
    expect(sorting.multiSortState).toEqual(acceptedMultiSort)
    expect(filtering.filters).toEqual(acceptedFilters)
    expect(filtering.filterValues).toEqual(acceptedFilterValues)
    expect(sorting.model.get()).toEqual({ sort: null, multiSort: rejectedMultiSort })
    expect(filtering.model.get()).toEqual({
      filters: rejectedFilters,
      filterValues: rejectedFilterValues,
    })
    const proposalCounts = {
      multiSort: onMultiSortChange.mock.calls.length,
      filters: onFiltersChange.mock.calls.length,
      filterValues: onFilterValuesChange.mock.calls.length,
      sortingEvents: sortingEvent.mock.calls.length,
      filteringEvents: filteringEvent.mock.calls.length,
    }

    act(() => {
      updateMultiSort(undefined)
      updateFilters(undefined)
      updateFilterValues(undefined)
    })
    expect(sorting.multiSortState).toEqual(acceptedMultiSort)
    expect(filtering.filters).toEqual(acceptedFilters)
    expect(filtering.filterValues).toEqual(acceptedFilterValues)
    expect(sorting.model.get()).toEqual({ sort: null, multiSort: acceptedMultiSort })
    expect(sorting.model.store.getState()).toEqual({ sort: null, multiSort: acceptedMultiSort })
    expect(filtering.model.get()).toEqual({
      filters: acceptedFilters,
      filterValues: acceptedFilterValues,
    })
    expect(filtering.model.store.getState()).toEqual({
      filters: acceptedFilters,
      filterValues: acceptedFilterValues,
    })
    expect(onMultiSortChange).toHaveBeenCalledTimes(proposalCounts.multiSort)
    expect(onFiltersChange).toHaveBeenCalledTimes(proposalCounts.filters)
    expect(onFilterValuesChange).toHaveBeenCalledTimes(proposalCounts.filterValues)
    expect(sortingEvent).toHaveBeenCalledTimes(proposalCounts.sortingEvents)
    expect(filteringEvent).toHaveBeenCalledTimes(proposalCounts.filteringEvents)
    view.unmount()
  })

  it('retains the first controlled snapshot across a no-op handoff and later detour', () => {
    const firstMultiSort: SortState[] = [{ key: 'name', direction: 'asc' }]
    const firstFilters = { status: 'active' }
    const firstFilterValues: GridFilterValues = { status: ['active'] }
    const secondMultiSort: SortState[] = [{ key: 'age', direction: 'desc' }]
    const secondFilters = { status: 'paused' }
    const secondFilterValues: GridFilterValues = { status: ['paused'] }
    const rejectedMultiSort: SortState[] = [{ key: 'id', direction: 'asc' }]
    const rejectedFilters = { status: 'rejected' }
    const rejectedFilterValues: GridFilterValues = { status: ['rejected'] }
    let updateMultiSort!: React.Dispatch<React.SetStateAction<SortState[] | undefined>>
    let updateFilters!: React.Dispatch<React.SetStateAction<Record<string, string> | undefined>>
    let updateFilterValues!: React.Dispatch<React.SetStateAction<GridFilterValues | undefined>>
    let core!: GridCore
    let sorting!: ReturnType<typeof useGridSorting>
    let filtering!: ReturnType<typeof useGridFiltering>

    function Harness() {
      const [multiSortState, setMultiSortState] = React.useState<SortState[] | undefined>(
        firstMultiSort,
      )
      const [filters, setFilters] = React.useState<Record<string, string> | undefined>(firstFilters)
      const [filterValues, setFilterValues] = React.useState<GridFilterValues | undefined>(
        firstFilterValues,
      )
      updateMultiSort = setMultiSortState
      updateFilters = setFilters
      updateFilterValues = setFilterValues
      core = useGridCore()
      sorting = useGridSorting(core, [], {
        leafColumns: [],
        multiSort: true,
        multiSortState,
      })
      filtering = useGridFiltering(core, [{ status: 'active' }], {
        columns: [{ key: 'status' }],
        getValue: (row, column) => row[column.key],
        filters,
        filterValues,
      })
      return null
    }

    const view = render(<Harness />)
    act(() => {
      updateMultiSort(undefined)
      updateFilters(undefined)
      updateFilterValues(undefined)
    })
    expect(sorting.multiSortState).toEqual(firstMultiSort)
    expect(filtering.filters).toEqual(firstFilters)
    expect(filtering.filterValues).toEqual(firstFilterValues)
    expect(sorting.model.get()).toEqual({ sort: null, multiSort: firstMultiSort })
    expect(filtering.model.get()).toEqual({
      filters: firstFilters,
      filterValues: firstFilterValues,
    })

    const uncontrolledMultiSort = sorting.multiSortState
    const uncontrolledFilters = filtering.filters
    const uncontrolledFilterValues = filtering.filterValues
    uncontrolledMultiSort[0]!.direction = 'desc'
    uncontrolledFilters.status = 'local'
    uncontrolledFilterValues.status!.push('local')
    expect(sorting.model.store.getState()).toEqual({ sort: null, multiSort: firstMultiSort })
    expect(filtering.model.store.getState()).toEqual({
      filters: firstFilters,
      filterValues: firstFilterValues,
    })

    act(() => {
      updateMultiSort(secondMultiSort)
      updateFilters(secondFilters)
      updateFilterValues(secondFilterValues)
    })
    expect(sorting.multiSortState).toEqual(secondMultiSort)
    expect(filtering.filters).toEqual(secondFilters)
    expect(filtering.filterValues).toEqual(secondFilterValues)

    act(() => {
      sorting.model.setMultiSort(rejectedMultiSort)
      filtering.model.setFilters(rejectedFilters)
      filtering.model.setFilterValues(rejectedFilterValues)
    })
    expect(sorting.multiSortState).toEqual(secondMultiSort)
    expect(filtering.filters).toEqual(secondFilters)
    expect(filtering.filterValues).toEqual(secondFilterValues)

    act(() => {
      updateMultiSort(undefined)
      updateFilters(undefined)
      updateFilterValues(undefined)
    })
    expect(sorting.multiSortState).toEqual(firstMultiSort)
    expect(filtering.filters).toEqual(firstFilters)
    expect(filtering.filterValues).toEqual(firstFilterValues)
    expect(sorting.model.get()).toEqual({ sort: null, multiSort: firstMultiSort })
    expect(sorting.model.store.getState()).toEqual({ sort: null, multiSort: firstMultiSort })
    expect(filtering.model.get()).toEqual({
      filters: firstFilters,
      filterValues: firstFilterValues,
    })
    expect(filtering.model.store.getState()).toEqual({
      filters: firstFilters,
      filterValues: firstFilterValues,
    })
    view.unmount()
  })
})
