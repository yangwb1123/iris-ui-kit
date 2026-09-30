import { cleanup, render, waitFor } from '@solidjs/testing-library'
import { createSignal } from 'solid-js'
import { describe, expect, it, afterEach, vi } from 'vitest'
import {
  GRID_FILTERING_CHANGE_EVENT,
  GRID_SELECTION_CHANGE_EVENT,
  GRID_SORTING_CHANGE_EVENT,
  GridCore,
  GridFilterValues,
  SortState,
} from '@iris-ui-kit/core/grid'
import { useGridCore, useGridFiltering, useGridSelection, useGridSorting } from './index'

afterEach(cleanup)

describe('solid grid controlled handoff', () => {
  it('rebases rejected controlled sort cycles from the accepted props', () => {
    const acceptedSort: SortState = { key: 'name', direction: 'asc' }
    const acceptedMultiSort: SortState[] = [{ key: 'name', direction: 'asc' }]
    const onSortChange = vi.fn()
    const onMultiSortChange = vi.fn()
    const sortingEvents = vi.fn()
    let sorting!: ReturnType<typeof useGridSorting>

    const Harness = (props: {
      sort: SortState
      multiSortState: SortState[]
      onSortChange: (sort: SortState | null) => void
      onMultiSortChange: (sorts: SortState[]) => void
    }) => {
      const core = useGridCore()
      core.on(GRID_SORTING_CHANGE_EVENT, sortingEvents)
      sorting = useGridSorting(core, { ...props, mode: 'multiple' })
      return (
        <>
          <output data-testid="sort">{JSON.stringify(sorting.sort())}</output>
          <output data-testid="multi-sort">{JSON.stringify(sorting.multiSort())}</output>
        </>
      )
    }

    const view = render(() => (
      <Harness
        sort={acceptedSort}
        multiSortState={acceptedMultiSort}
        onSortChange={onSortChange}
        onMultiSortChange={onMultiSortChange}
      />
    ))

    sorting.cycleSort('name')
    sorting.cycleSort('name')
    sorting.cycleMultiSort('name')
    sorting.cycleMultiSort('name')

    expect(onSortChange).toHaveBeenCalledTimes(2)
    expect(onSortChange).toHaveBeenNthCalledWith(1, { key: 'name', direction: 'desc' })
    expect(onSortChange).toHaveBeenNthCalledWith(2, { key: 'name', direction: 'desc' })
    expect(onMultiSortChange).toHaveBeenCalledTimes(2)
    expect(onMultiSortChange).toHaveBeenNthCalledWith(1, [{ key: 'name', direction: 'desc' }])
    expect(onMultiSortChange).toHaveBeenNthCalledWith(2, [{ key: 'name', direction: 'desc' }])
    expect(sortingEvents).toHaveBeenCalledTimes(4)
    expect(sorting.sort()).toEqual(acceptedSort)
    expect(sorting.multiSort()).toEqual(acceptedMultiSort)
    expect(view.getByTestId('sort').textContent).toBe(JSON.stringify(acceptedSort))
    expect(view.getByTestId('multi-sort').textContent).toBe(JSON.stringify(acceptedMultiSort))
    view.unmount()
  })

  it('restores accepted Grid snapshots after rejected controlled proposals', async () => {
    type Props = {
      value?: string[]
      sort?: SortState | null
      multiSortState?: SortState[]
      filters?: Record<string, string>
      filterValues?: GridFilterValues
      defaultValue: string[]
      defaultSort: SortState | null
      defaultMultiSort: SortState[]
      defaultFilters: Record<string, string>
      defaultFilterValues: GridFilterValues
      onChange: (keys: string[]) => void
      onSortChange: (sort: SortState | null) => void
      onMultiSortChange: (sorts: SortState[]) => void
      onFiltersChange: (filters: Record<string, string>) => void
      onFilterValuesChange: (values: GridFilterValues) => void
    }

    const onChange = vi.fn()
    const onSortChange = vi.fn()
    const onMultiSortChange = vi.fn()
    const onFiltersChange = vi.fn()
    const onFilterValuesChange = vi.fn()
    const selectionEvent = vi.fn()
    const sortingEvent = vi.fn()
    const filteringEvent = vi.fn()
    let setValue!: (value: string[] | undefined) => void
    let setSort!: (value: SortState | null | undefined) => void
    let setMultiSort!: (value: SortState[] | undefined) => void
    let setFilters!: (value: Record<string, string> | undefined) => void
    let setFilterValues!: (value: GridFilterValues | undefined) => void
    let core!: GridCore
    let selection!: ReturnType<typeof useGridSelection>
    let sorting!: ReturnType<typeof useGridSorting>
    let filtering!: ReturnType<typeof useGridFiltering>

    const Harness = (props: Props) => {
      core = useGridCore()
      selection = useGridSelection(core, props)
      sorting = useGridSorting(core, props)
      filtering = useGridFiltering(core, props)
      core.on(GRID_SELECTION_CHANGE_EVENT, selectionEvent)
      core.on(GRID_SORTING_CHANGE_EVENT, sortingEvent)
      core.on(GRID_FILTERING_CHANGE_EVENT, filteringEvent)
      return <div />
    }
    const Parent = () => {
      const [value, updateValue] = createSignal<string[] | undefined>(['accepted-selection'])
      const [sort, updateSort] = createSignal<SortState | null | undefined>(null)
      const [multiSortState, updateMultiSort] = createSignal<SortState[] | undefined>([])
      const [filters, updateFilters] = createSignal<Record<string, string> | undefined>({})
      const [filterValues, updateFilterValues] = createSignal<GridFilterValues | undefined>({})
      setValue = updateValue
      setSort = updateSort
      setMultiSort = updateMultiSort
      setFilters = updateFilters
      setFilterValues = updateFilterValues
      return (
        <Harness
          value={value()}
          sort={sort()}
          multiSortState={multiSortState()}
          filters={filters()}
          filterValues={filterValues()}
          defaultValue={['default-selection']}
          defaultSort={{ key: 'default-sort', direction: 'asc' }}
          defaultMultiSort={[{ key: 'default-multi', direction: 'asc' }]}
          defaultFilters={{ default: 'filter' }}
          defaultFilterValues={{ default: ['value'] }}
          onChange={onChange}
          onSortChange={onSortChange}
          onMultiSortChange={onMultiSortChange}
          onFiltersChange={onFiltersChange}
          onFilterValuesChange={onFilterValuesChange}
        />
      )
    }

    const view = render(() => <Parent />)
    const initialSelectionModel = selection.model
    const initialSortingModel = sorting.model
    const initialFilteringModel = filtering.model
    expect(selection.model).toBe(core.invoke('getSelectionModel'))
    expect(sorting.model).toBe(core.invoke('getSortingModel'))
    expect(filtering.model).toBe(core.invoke('getFilteringModel'))
    await waitFor(() => {
      expect(selection.selection()).toEqual(['accepted-selection'])
      expect(sorting.sort()).toBeNull()
      expect(sorting.multiSort()).toEqual([])
      expect(filtering.filters()).toEqual({})
      expect(filtering.filterValues()).toEqual({})
    })

    vi.clearAllMocks()
    selection.model.toggle('rejected-selection')
    sorting.model.setSort({ key: 'rejected-sort', direction: 'asc' })
    sorting.model.setMultiSort([{ key: 'rejected-multi', direction: 'asc' }])
    filtering.model.setFilters({ rejected: 'filter' })
    filtering.model.setFilterValues({ rejected: ['value'] })
    expect(selection.selection()).toEqual(['accepted-selection'])
    expect(sorting.sort()).toBeNull()
    expect(sorting.multiSort()).toEqual([])
    expect(filtering.filters()).toEqual({})
    expect(filtering.filterValues()).toEqual({})
    expect(selection.model.get()).toEqual(['accepted-selection', 'rejected-selection'])
    expect(sorting.model.get()).toEqual({
      sort: { key: 'rejected-sort', direction: 'asc' },
      multiSort: [{ key: 'rejected-multi', direction: 'asc' }],
    })
    expect(filtering.model.get()).toEqual({
      filters: { rejected: 'filter' },
      filterValues: { rejected: ['value'] },
    })
    const proposalCounts = {
      selection: onChange.mock.calls.length,
      sort: onSortChange.mock.calls.length,
      multiSort: onMultiSortChange.mock.calls.length,
      filters: onFiltersChange.mock.calls.length,
      filterValues: onFilterValuesChange.mock.calls.length,
      selectionEvent: selectionEvent.mock.calls.length,
      sortingEvent: sortingEvent.mock.calls.length,
      filteringEvent: filteringEvent.mock.calls.length,
    }

    setValue(undefined)
    setSort(undefined)
    setMultiSort(undefined)
    setFilters(undefined)
    setFilterValues(undefined)
    await waitFor(() => {
      expect(selection.selection()).toEqual(['accepted-selection'])
      expect(sorting.sort()).toBeNull()
      expect(sorting.multiSort()).toEqual([])
      expect(filtering.filters()).toEqual({})
      expect(filtering.filterValues()).toEqual({})
      expect(selection.model.get()).toEqual(['accepted-selection'])
      expect(sorting.model.get()).toEqual({ sort: null, multiSort: [] })
      expect(filtering.model.get()).toEqual({ filters: {}, filterValues: {} })
    })
    expect(onChange).toHaveBeenCalledTimes(proposalCounts.selection)
    expect(onSortChange).toHaveBeenCalledTimes(proposalCounts.sort)
    expect(onMultiSortChange).toHaveBeenCalledTimes(proposalCounts.multiSort)
    expect(onFiltersChange).toHaveBeenCalledTimes(proposalCounts.filters)
    expect(onFilterValuesChange).toHaveBeenCalledTimes(proposalCounts.filterValues)
    expect(selectionEvent).toHaveBeenCalledTimes(proposalCounts.selectionEvent)
    expect(sortingEvent).toHaveBeenCalledTimes(proposalCounts.sortingEvent)
    expect(filteringEvent).toHaveBeenCalledTimes(proposalCounts.filteringEvent)
    expect(selection.model).toBe(initialSelectionModel)
    expect(sorting.model).toBe(initialSortingModel)
    expect(filtering.model).toBe(initialFilteringModel)
    expect(selection.model).toBe(core.invoke('getSelectionModel'))
    expect(sorting.model).toBe(core.invoke('getSortingModel'))
    expect(filtering.model).toBe(core.invoke('getFilteringModel'))
    view.unmount()
  })

  it('restores initial Grid defaults after a rejected controlled detour', async () => {
    type Props = {
      mode?: 'single' | 'multiple'
      value?: string[]
      sort?: SortState | null
      multiSortState?: SortState[]
      filters?: Record<string, string>
      filterValues?: GridFilterValues
      defaultValue: string[]
      defaultSort: SortState | null
      defaultMultiSort: SortState[]
      defaultFilters: Record<string, string>
      defaultFilterValues: GridFilterValues
      onChange: (keys: string[]) => void
      onSortChange: (sort: SortState | null) => void
      onMultiSortChange: (sorts: SortState[]) => void
      onFiltersChange: (filters: Record<string, string>) => void
      onFilterValuesChange: (values: GridFilterValues) => void
    }

    const onChange = vi.fn()
    const onSortChange = vi.fn()
    const onMultiSortChange = vi.fn()
    const onFiltersChange = vi.fn()
    const onFilterValuesChange = vi.fn()
    const selectionEvent = vi.fn()
    const sortingEvent = vi.fn()
    const filteringEvent = vi.fn()
    let setValue!: (value: string[] | undefined) => void
    let setSort!: (value: SortState | null | undefined) => void
    let setMultiSort!: (value: SortState[] | undefined) => void
    let setFilters!: (value: Record<string, string> | undefined) => void
    let setFilterValues!: (value: GridFilterValues | undefined) => void
    let core!: GridCore
    let selection!: ReturnType<typeof useGridSelection>
    let sorting!: ReturnType<typeof useGridSorting>
    let filtering!: ReturnType<typeof useGridFiltering>

    const Harness = (props: Props) => {
      core = useGridCore()
      selection = useGridSelection(core, props)
      sorting = useGridSorting(core, props)
      filtering = useGridFiltering(core, props)
      core.on(GRID_SELECTION_CHANGE_EVENT, selectionEvent)
      core.on(GRID_SORTING_CHANGE_EVENT, sortingEvent)
      core.on(GRID_FILTERING_CHANGE_EVENT, filteringEvent)
      return <div />
    }
    const Parent = () => {
      const [value, updateValue] = createSignal<string[] | undefined>()
      const [sort, updateSort] = createSignal<SortState | null | undefined>()
      const [multiSortState, updateMultiSort] = createSignal<SortState[] | undefined>()
      const [filters, updateFilters] = createSignal<Record<string, string> | undefined>()
      const [filterValues, updateFilterValues] = createSignal<GridFilterValues | undefined>()
      setValue = updateValue
      setSort = updateSort
      setMultiSort = updateMultiSort
      setFilters = updateFilters
      setFilterValues = updateFilterValues
      return (
        <Harness
          mode="multiple"
          value={value()}
          sort={sort()}
          multiSortState={multiSortState()}
          filters={filters()}
          filterValues={filterValues()}
          defaultValue={['default-selection']}
          defaultSort={{ key: 'default-sort', direction: 'asc' }}
          defaultMultiSort={[{ key: 'default-multi', direction: 'asc' }]}
          defaultFilters={{ default: 'filter' }}
          defaultFilterValues={{ default: ['value'] }}
          onChange={onChange}
          onSortChange={onSortChange}
          onMultiSortChange={onMultiSortChange}
          onFiltersChange={onFiltersChange}
          onFilterValuesChange={onFilterValuesChange}
        />
      )
    }

    const view = render(() => <Parent />)
    const initialSelectionModel = selection.model
    const initialSortingModel = sorting.model
    const initialFilteringModel = filtering.model
    await waitFor(() => {
      expect(selection.selection()).toEqual(['default-selection'])
      expect(sorting.sort()).toEqual({ key: 'default-sort', direction: 'asc' })
      expect(sorting.multiSort()).toEqual([{ key: 'default-multi', direction: 'asc' }])
      expect(filtering.filters()).toEqual({ default: 'filter' })
      expect(filtering.filterValues()).toEqual({ default: ['value'] })
    })
    expect(selection.model).toBe(core.invoke('getSelectionModel'))
    expect(sorting.model).toBe(core.invoke('getSortingModel'))
    expect(filtering.model).toBe(core.invoke('getFilteringModel'))

    setValue(['accepted-selection'])
    setSort(null)
    setMultiSort([])
    setFilters({})
    setFilterValues({})
    await waitFor(() => {
      expect(selection.model.get()).toEqual(['accepted-selection'])
      expect(sorting.model.get()).toEqual({ sort: null, multiSort: [] })
      expect(filtering.model.get()).toEqual({ filters: {}, filterValues: {} })
    })

    vi.clearAllMocks()
    selection.model.toggle('rejected-selection')
    sorting.model.setSort({ key: 'rejected-sort', direction: 'asc' })
    sorting.model.setMultiSort([{ key: 'rejected-multi', direction: 'asc' }])
    filtering.model.setFilters({ rejected: 'filter' })
    filtering.model.setFilterValues({ rejected: ['value'] })
    expect(selection.selection()).toEqual(['accepted-selection'])
    expect(sorting.sort()).toBeNull()
    expect(sorting.multiSort()).toEqual([])
    expect(filtering.filters()).toEqual({})
    expect(filtering.filterValues()).toEqual({})
    const proposalCounts = {
      selection: onChange.mock.calls.length,
      sort: onSortChange.mock.calls.length,
      multiSort: onMultiSortChange.mock.calls.length,
      filters: onFiltersChange.mock.calls.length,
      filterValues: onFilterValuesChange.mock.calls.length,
      selectionEvent: selectionEvent.mock.calls.length,
      sortingEvent: sortingEvent.mock.calls.length,
      filteringEvent: filteringEvent.mock.calls.length,
    }

    setValue(undefined)
    setSort(undefined)
    setMultiSort(undefined)
    setFilters(undefined)
    setFilterValues(undefined)
    await waitFor(() => {
      expect(selection.selection()).toEqual(['default-selection'])
      expect(sorting.sort()).toEqual({ key: 'default-sort', direction: 'asc' })
      expect(sorting.multiSort()).toEqual([{ key: 'default-multi', direction: 'asc' }])
      expect(filtering.filters()).toEqual({ default: 'filter' })
      expect(filtering.filterValues()).toEqual({ default: ['value'] })
      expect(selection.model.get()).toEqual(['default-selection'])
      expect(sorting.model.get()).toEqual({
        sort: { key: 'default-sort', direction: 'asc' },
        multiSort: [{ key: 'default-multi', direction: 'asc' }],
      })
      expect(filtering.model.get()).toEqual({
        filters: { default: 'filter' },
        filterValues: { default: ['value'] },
      })
    })
    expect(onChange).toHaveBeenCalledTimes(proposalCounts.selection)
    expect(onSortChange).toHaveBeenCalledTimes(proposalCounts.sort)
    expect(onMultiSortChange).toHaveBeenCalledTimes(proposalCounts.multiSort)
    expect(onFiltersChange).toHaveBeenCalledTimes(proposalCounts.filters)
    expect(onFilterValuesChange).toHaveBeenCalledTimes(proposalCounts.filterValues)
    expect(selectionEvent).toHaveBeenCalledTimes(proposalCounts.selectionEvent)
    expect(sortingEvent).toHaveBeenCalledTimes(proposalCounts.sortingEvent)
    expect(filteringEvent).toHaveBeenCalledTimes(proposalCounts.filteringEvent)
    expect(selection.model).toBe(initialSelectionModel)
    expect(sorting.model).toBe(initialSortingModel)
    expect(filtering.model).toBe(initialFilteringModel)
    expect(selection.model).toBe(core.invoke('getSelectionModel'))
    expect(sorting.model).toBe(core.invoke('getSortingModel'))
    expect(filtering.model).toBe(core.invoke('getFilteringModel'))
    view.unmount()
  })
})
