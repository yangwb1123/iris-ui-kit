import * as React from 'react'
import { act, render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import {
  GRID_FILTERING_CHANGE_EVENT,
  GRID_SORTING_CHANGE_EVENT,
  type GridCore,
  type GridFilterValues,
  type GridFilteringModel,
} from '@iris-ui-kit/core/grid'
import { useGridCore } from './useGridCore'
import { useGridFiltering } from './useGridFiltering'
import { useGridSorting } from './useGridSorting'

describe('useGridFiltering', () => {
  const data: Record<string, unknown>[] = [{ status: 'active' }]
  const columns = [{ key: 'status' }]

  it('keeps uncontrolled snapshots detached from Core state', () => {
    const onFiltersChange = vi.fn()
    const onFilterValuesChange = vi.fn()
    const filteringEvent = vi.fn()
    const storeObserver = vi.fn()
    let core!: GridCore
    let filtering!: ReturnType<typeof useGridFiltering>

    function Harness() {
      core = useGridCore()
      filtering = useGridFiltering(core, data, {
        columns,
        getValue: (row, column) => row[column.key],
        defaultFilters: { status: 'active' },
        defaultFilterValues: { status: ['active', 'pending'] },
        onFiltersChange,
        onFilterValuesChange,
      })
      return null
    }

    const view = render(<Harness />)
    const unsubscribeEvent = core.on(GRID_FILTERING_CHANGE_EVENT, filteringEvent)
    const unsubscribeStore = filtering.model.store.subscribe(storeObserver)
    const initial = filtering.model.get()
    const callbackCounts = {
      filters: onFiltersChange.mock.calls.length,
      filterValues: onFilterValuesChange.mock.calls.length,
      events: filteringEvent.mock.calls.length,
      store: storeObserver.mock.calls.length,
    }
    const filtersSnapshot = filtering.filters
    const filterValuesSnapshot = filtering.filterValues

    filtersSnapshot.status = 'paused'
    filterValuesSnapshot.status!.push('archived')

    expect(filtering.model.get()).toEqual(initial)
    expect(filtering.model.store.getState()).toEqual(initial)
    expect(onFiltersChange).toHaveBeenCalledTimes(callbackCounts.filters)
    expect(onFilterValuesChange).toHaveBeenCalledTimes(callbackCounts.filterValues)
    expect(filteringEvent).toHaveBeenCalledTimes(callbackCounts.events)
    expect(storeObserver).toHaveBeenCalledTimes(callbackCounts.store)

    unsubscribeStore()
    unsubscribeEvent()
    view.unmount()
  })

  it('restores independent multi-sort and filtering snapshots after rejected detours', () => {
    const defaultMultiSort: SortState[] = [{ key: 'default-multi', direction: 'asc' }]
    const defaultFilters = { default: 'filter' }
    const defaultFilterValues: GridFilterValues = { default: ['value'] }
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
      const [multiSortState, setMultiSortState] = React.useState<SortState[] | undefined>()
      const [filters, setFilters] = React.useState<Record<string, string> | undefined>()
      const [filterValues, setFilterValues] = React.useState<GridFilterValues | undefined>()
      updateMultiSort = setMultiSortState
      updateFilters = setFilters
      updateFilterValues = setFilterValues
      core = useGridCore()
      sorting = useGridSorting(core, [], {
        leafColumns: [],
        multiSort: true,
        multiSortState,
        defaultMultiSort,
        onMultiSortChange,
      })
      filtering = useGridFiltering(core, [{ status: 'active' }], {
        columns: [{ key: 'status' }],
        getValue: (row, column) => row[column.key],
        filters,
        defaultFilters,
        filterValues,
        defaultFilterValues,
        onFiltersChange,
        onFilterValuesChange,
      })
      return null
    }

    const view = render(<Harness />)
    const initialSortingModel = sorting.model
    const initialFilteringModel = filtering.model
    const unsubscribeSorting = core.on(GRID_SORTING_CHANGE_EVENT, sortingEvent)
    const unsubscribeFiltering = core.on(GRID_FILTERING_CHANGE_EVENT, filteringEvent)

    expect(sorting.multiSortState).toEqual(defaultMultiSort)
    expect(filtering.filters).toEqual(defaultFilters)
    expect(filtering.filterValues).toEqual(defaultFilterValues)

    act(() => {
      updateMultiSort([])
      updateFilters({})
      updateFilterValues({})
    })
    expect(sorting.multiSortState).toEqual([])
    expect(filtering.filters).toEqual({})
    expect(filtering.filterValues).toEqual({})
    expect(sorting.model.get()).toMatchObject({ multiSort: [] })
    expect(filtering.model.get()).toEqual({ filters: {}, filterValues: {} })

    act(() => {
      sorting.model.setMultiSort([{ key: 'rejected-multi', direction: 'asc' }])
      filtering.model.setFilters({ rejected: 'filter' })
      filtering.model.setFilterValues({ rejected: ['value'] })
    })
    expect(sorting.multiSortState).toEqual([])
    expect(filtering.filters).toEqual({})
    expect(filtering.filterValues).toEqual({})
    const counts = {
      multiSort: onMultiSortChange.mock.calls.length,
      filters: onFiltersChange.mock.calls.length,
      filterValues: onFilterValuesChange.mock.calls.length,
      sortingEvents: sortingEvent.mock.calls.length,
      filteringEvents: filteringEvent.mock.calls.length,
    }

    act(() => updateFilters(undefined))
    expect(filtering.filters).toEqual(defaultFilters)
    expect(filtering.filterValues).toEqual({})
    expect(filtering.model.get()).toEqual({
      filters: defaultFilters,
      filterValues: { rejected: ['value'] },
    })

    act(() => {
      updateFilterValues(undefined)
      updateMultiSort(undefined)
    })
    expect(sorting.multiSortState).toEqual(defaultMultiSort)
    expect(filtering.filters).toEqual(defaultFilters)
    expect(filtering.filterValues).toEqual(defaultFilterValues)
    expect(sorting.model.get()).toEqual({ sort: null, multiSort: defaultMultiSort })
    expect(filtering.model.get()).toEqual({
      filters: defaultFilters,
      filterValues: defaultFilterValues,
    })
    expect(onMultiSortChange).toHaveBeenCalledTimes(counts.multiSort)
    expect(onFiltersChange).toHaveBeenCalledTimes(counts.filters)
    expect(onFilterValuesChange).toHaveBeenCalledTimes(counts.filterValues)
    expect(sortingEvent).toHaveBeenCalledTimes(counts.sortingEvents)
    expect(filteringEvent).toHaveBeenCalledTimes(counts.filteringEvents)
    expect(sorting.model).toBe(initialSortingModel)
    expect(filtering.model).toBe(initialFilteringModel)
    expect(core.invoke<GridSortingModel>('getSortingModel')).toBe(initialSortingModel)
    expect(core.invoke<GridFilteringModel>('getFilteringModel')).toBe(initialFilteringModel)

    unsubscribeSorting()
    unsubscribeFiltering()
    view.unmount()
  })

  it('keeps controlled inputs isolated from mutable bridge snapshots', () => {
    const filters = { status: 'active' }
    const filterValues = { status: ['active', 'pending'] }
    const onFiltersChange = vi.fn()
    const onFilterValuesChange = vi.fn()
    const filteringEvent = vi.fn()
    const storeObserver = vi.fn()
    let core!: GridCore
    let filtering!: ReturnType<typeof useGridFiltering>

    function Harness() {
      core = useGridCore()
      filtering = useGridFiltering(core, data, {
        columns,
        getValue: (row, column) => row[column.key],
        filters,
        filterValues,
        onFiltersChange,
        onFilterValuesChange,
      })
      return null
    }

    const view = render(<Harness />)
    const unsubscribeEvent = core.on(GRID_FILTERING_CHANGE_EVENT, filteringEvent)
    const unsubscribeStore = filtering.model.store.subscribe(storeObserver)
    const initial = filtering.model.get()
    const callbackCounts = {
      filters: onFiltersChange.mock.calls.length,
      filterValues: onFilterValuesChange.mock.calls.length,
      events: filteringEvent.mock.calls.length,
      store: storeObserver.mock.calls.length,
    }
    const filtersSnapshot = filtering.filters
    const filterValuesSnapshot = filtering.filterValues

    expect(filtersSnapshot).not.toBe(filters)
    expect(filterValuesSnapshot).not.toBe(filterValues)
    expect(filterValuesSnapshot.status).not.toBe(filterValues.status)

    filtersSnapshot.status = 'paused'
    filterValuesSnapshot.status!.push('archived')

    expect(filters).toEqual({ status: 'active' })
    expect(filterValues).toEqual({ status: ['active', 'pending'] })
    expect(filtering.model.get()).toEqual(initial)
    expect(filtering.model.store.getState()).toEqual(initial)
    expect(onFiltersChange).toHaveBeenCalledTimes(callbackCounts.filters)
    expect(onFilterValuesChange).toHaveBeenCalledTimes(callbackCounts.filterValues)
    expect(filteringEvent).toHaveBeenCalledTimes(callbackCounts.events)
    expect(storeObserver).toHaveBeenCalledTimes(callbackCounts.store)

    unsubscribeStore()
    unsubscribeEvent()
    view.unmount()
  })
})
