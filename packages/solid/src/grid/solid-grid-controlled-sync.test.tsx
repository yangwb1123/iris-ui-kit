import { cleanup, render, waitFor } from '@solidjs/testing-library'
import { createSignal } from 'solid-js'
import { describe, expect, it, afterEach, vi } from 'vitest'
import {
  GRID_FILTERING_CHANGE_EVENT,
  GRID_SELECTION_CHANGE_EVENT,
  GRID_SORTING_CHANGE_EVENT,
  GridFilterValues,
  SortState,
} from '@iris-ui-kit/core/grid'
import { useGridCore, useGridFiltering, useGridSelection, useGridSorting } from './index'

afterEach(cleanup)

describe('solid grid controlled sync', () => {
  it('silently syncs controlled selection, sorting, and filtering before model operations', async () => {
    type ControlledProps = {
      value: string[]
      sort: SortState | null
      multiSortState: SortState[]
      filters: Record<string, string>
      filterValues: GridFilterValues
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
    const selectionEvents = vi.fn()
    const sortingEvents = vi.fn()
    const filteringEvents = vi.fn()
    let setValue!: (value: string[]) => void
    let setSort!: (value: SortState | null) => void
    let setMultiSort!: (value: SortState[]) => void
    let setFilters!: (value: Record<string, string>) => void
    let setFilterValues!: (value: GridFilterValues) => void
    let selection!: ReturnType<typeof useGridSelection>
    let sorting!: ReturnType<typeof useGridSorting>
    let filtering!: ReturnType<typeof useGridFiltering>

    const Harness = (props: ControlledProps) => {
      const core = useGridCore()
      selection = useGridSelection(core, props)
      sorting = useGridSorting(core, props)
      filtering = useGridFiltering(core, props)
      core.on(GRID_SELECTION_CHANGE_EVENT, selectionEvents)
      core.on(GRID_SORTING_CHANGE_EVENT, sortingEvents)
      core.on(GRID_FILTERING_CHANGE_EVENT, filteringEvents)
      return <div />
    }
    const Parent = () => {
      const [value, updateValue] = createSignal<string[]>(['a'])
      const [sort, updateSort] = createSignal<SortState | null>({
        key: 'name',
        direction: 'asc',
      })
      const [multiSortState, updateMultiSort] = createSignal<SortState[]>([
        { key: 'name', direction: 'asc' },
      ])
      const [filters, updateFilters] = createSignal<Record<string, string>>({ name: 'old' })
      const [filterValues, updateFilterValues] = createSignal<GridFilterValues>({
        status: ['active'],
      })
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
          onChange={onChange}
          onSortChange={onSortChange}
          onMultiSortChange={onMultiSortChange}
          onFiltersChange={onFiltersChange}
          onFilterValuesChange={onFilterValuesChange}
        />
      )
    }

    const view = render(() => <Parent />)
    setValue(['b'])
    setSort({ key: 'age', direction: 'asc' })
    setMultiSort([{ key: 'status', direction: 'desc' }])
    setFilters({ status: 'paused' })
    setFilterValues({ status: ['paused'], region: ['eu'] })

    await waitFor(() => {
      expect(selection.model.get()).toEqual(['b'])
      expect(sorting.model.get()).toEqual({
        sort: { key: 'age', direction: 'asc' },
        multiSort: [{ key: 'status', direction: 'desc' }],
      })
      expect(filtering.model.get()).toEqual({
        filters: { status: 'paused' },
        filterValues: { status: ['paused'], region: ['eu'] },
      })
    })
    expect(onChange).not.toHaveBeenCalled()
    expect(onSortChange).not.toHaveBeenCalled()
    expect(onMultiSortChange).not.toHaveBeenCalled()
    expect(onFiltersChange).not.toHaveBeenCalled()
    expect(onFilterValuesChange).not.toHaveBeenCalled()
    expect(selectionEvents).not.toHaveBeenCalled()
    expect(sortingEvents).not.toHaveBeenCalled()
    expect(filteringEvents).not.toHaveBeenCalled()

    selection.model.toggle('b')
    sorting.model.cycleSort('age')
    sorting.model.cycleMultiSort('status')
    filtering.model.setFilter('name', 'new')
    filtering.model.setColumnFilterValues('region', ['us'])

    expect(selection.model.get()).toEqual([])
    expect(sorting.model.get()).toEqual({
      sort: { key: 'age', direction: 'desc' },
      multiSort: [],
    })
    expect(filtering.model.get()).toEqual({
      filters: { status: 'paused', name: 'new' },
      filterValues: { status: ['paused'], region: ['us'] },
    })
    expect(onChange).toHaveBeenLastCalledWith([])
    expect(onSortChange).toHaveBeenLastCalledWith({ key: 'age', direction: 'desc' })
    expect(onMultiSortChange).toHaveBeenLastCalledWith([])
    expect(onFiltersChange).toHaveBeenLastCalledWith({ status: 'paused', name: 'new' })
    expect(onFilterValuesChange).toHaveBeenLastCalledWith({
      status: ['paused'],
      region: ['us'],
    })
    expect(selectionEvents).toHaveBeenLastCalledWith({ selectedKeys: [] })
    expect(sortingEvents).toHaveBeenNthCalledWith(1, {
      mode: 'single',
      sort: { key: 'age', direction: 'desc' },
    })
    expect(sortingEvents).toHaveBeenNthCalledWith(2, { mode: 'multiple', sorts: [] })
    expect(filteringEvents).toHaveBeenNthCalledWith(1, {
      channel: 'filters',
      filters: { status: 'paused', name: 'new' },
    })
    expect(filteringEvents).toHaveBeenNthCalledWith(2, {
      channel: 'values',
      filterValues: { status: ['paused'], region: ['us'] },
    })

    vi.clearAllMocks()
    setValue(['stale'])
    setSort({ key: 'stale', direction: 'asc' })
    setMultiSort([{ key: 'stale', direction: 'asc' }])
    setFilters({ stale: 'value' })
    setFilterValues({ stale: ['value'] })
    await waitFor(() => {
      expect(selection.model.get()).toEqual(['stale'])
      expect(sorting.model.get()).toEqual({
        sort: { key: 'stale', direction: 'asc' },
        multiSort: [{ key: 'stale', direction: 'asc' }],
      })
      expect(filtering.model.get()).toEqual({
        filters: { stale: 'value' },
        filterValues: { stale: ['value'] },
      })
    })
    setValue([])
    setSort(null)
    setMultiSort([])
    setFilters({})
    setFilterValues({})
    await waitFor(() => {
      expect(selection.model.get()).toEqual([])
      expect(sorting.model.get()).toEqual({ sort: null, multiSort: [] })
      expect(filtering.model.get()).toEqual({ filters: {}, filterValues: {} })
    })
    expect(onChange).not.toHaveBeenCalled()
    expect(onSortChange).not.toHaveBeenCalled()
    expect(onMultiSortChange).not.toHaveBeenCalled()
    expect(onFiltersChange).not.toHaveBeenCalled()
    expect(onFilterValuesChange).not.toHaveBeenCalled()
    expect(selectionEvents).not.toHaveBeenCalled()
    expect(sortingEvents).not.toHaveBeenCalled()
    expect(filteringEvents).not.toHaveBeenCalled()
    view.unmount()
  })

  it('preserves multi-sort and filtering baselines across silent controlled handoffs', async () => {
    const multiSortA: SortState[] = [{ key: 'name', direction: 'asc' }]
    const multiSortB: SortState[] = [{ key: 'status', direction: 'desc' }]
    const filtersA = { name: 'Ada' }
    const filtersB = { status: 'active' }
    const filterValuesA: GridFilterValues = { status: ['active'] }
    const filterValuesB: GridFilterValues = { region: ['eu', 'us'] }
    const onMultiSortChange = vi.fn()
    const onFiltersChange = vi.fn()
    const onFilterValuesChange = vi.fn()
    const sortingEvents = vi.fn()
    const filteringEvents = vi.fn()
    let setMultiSort!: (value: SortState[] | undefined) => void
    let setFilters!: (value: Record<string, string> | undefined) => void
    let setFilterValues!: (value: GridFilterValues | undefined) => void
    let sorting!: ReturnType<typeof useGridSorting>
    let filtering!: ReturnType<typeof useGridFiltering>

    type Props = {
      mode?: 'single' | 'multiple'
      multiSortState?: SortState[]
      filters?: Record<string, string>
      filterValues?: GridFilterValues
      onMultiSortChange: (sorts: SortState[]) => void
      onFiltersChange: (next: Record<string, string>) => void
      onFilterValuesChange: (next: GridFilterValues) => void
    }
    const Harness = (props: Props) => {
      const core = useGridCore()
      sorting = useGridSorting(core, props)
      filtering = useGridFiltering(core, props)
      core.on(GRID_SORTING_CHANGE_EVENT, sortingEvents)
      core.on(GRID_FILTERING_CHANGE_EVENT, filteringEvents)
      return <div />
    }
    const Parent = () => {
      const [multiSortState, updateMultiSort] = createSignal<SortState[] | undefined>(multiSortA)
      const [filters, updateFilters] = createSignal<Record<string, string> | undefined>(filtersA)
      const [filterValues, updateFilterValues] = createSignal<GridFilterValues | undefined>(
        filterValuesA,
      )
      setMultiSort = updateMultiSort
      setFilters = updateFilters
      setFilterValues = updateFilterValues
      return (
        <Harness
          mode="multiple"
          multiSortState={multiSortState()}
          filters={filters()}
          filterValues={filterValues()}
          onMultiSortChange={onMultiSortChange}
          onFiltersChange={onFiltersChange}
          onFilterValuesChange={onFilterValuesChange}
        />
      )
    }

    const view = render(() => <Parent />)
    const expectState = (
      multiSort: SortState[],
      filters: Record<string, string>,
      filterValues: GridFilterValues,
    ) => {
      expect(sorting.multiSort()).toEqual(multiSort)
      expect(sorting.model.get().multiSort).toEqual(multiSort)
      expect(filtering.filters()).toEqual(filters)
      expect(filtering.model.get().filters).toEqual(filters)
      expect(filtering.filterValues()).toEqual(filterValues)
      expect(filtering.model.get().filterValues).toEqual(filterValues)
    }
    const counts = () => ({
      multiSort: onMultiSortChange.mock.calls.length,
      filters: onFiltersChange.mock.calls.length,
      filterValues: onFilterValuesChange.mock.calls.length,
      sortingEvents: sortingEvents.mock.calls.length,
      filteringEvents: filteringEvents.mock.calls.length,
    })

    await waitFor(() => expectState(multiSortA, filtersA, filterValuesA))
    const beforeHandoff = counts()

    setMultiSort(undefined)
    setFilters(undefined)
    setFilterValues(undefined)
    await waitFor(() => {
      expectState(multiSortA, filtersA, filterValuesA)
      expect(counts()).toEqual(beforeHandoff)
    })

    setMultiSort(multiSortB)
    setFilters(filtersB)
    setFilterValues(filterValuesB)
    await waitFor(() => {
      expectState(multiSortB, filtersB, filterValuesB)
      expect(counts()).toEqual(beforeHandoff)
    })

    setMultiSort(undefined)
    setFilters(undefined)
    setFilterValues(undefined)
    await waitFor(() => {
      expectState(multiSortA, filtersA, filterValuesA)
      expect(counts()).toEqual(beforeHandoff)
    })
    view.unmount()
  })
})
