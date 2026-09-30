import { render } from '@testing-library/svelte'
import { tick } from 'svelte'
import { describe, expect, it, vi } from 'vitest'
import { get, type Readable } from 'svelte/store'
import {
  type GridCore,
  type GridFilterValues,
  type GridFilteringModel,
  type GridSortingModel,
  type SelectionModel,
  type SortState,
} from '@iris-ui-kit/core/grid'
import GridSelectionControlledHarness from './GridSelectionControlledHarness.svelte'

describe('Svelte Grid sorting filtering', () => {
  it('syncs controlled sorting and filtering props silently on stable models', async () => {
    let core!: GridCore<{ id: string }>
    let selectionModel!: SelectionModel<string>
    let sortingModel!: GridSortingModel
    let filteringModel!: GridFilteringModel
    let selection!: Readable<string[]>
    let sort!: Readable<SortState | null>
    let multiSort!: Readable<SortState[]>
    let filters!: Readable<Record<string, string>>
    let filterValues!: Readable<GridFilterValues>
    const onChange = vi.fn()
    const onSortChange = vi.fn()
    const onMultiSortChange = vi.fn()
    const onFiltersChange = vi.fn()
    const onFilterValuesChange = vi.fn()
    const selectionEvent = vi.fn()
    const sortingEvent = vi.fn()
    const filteringEvent = vi.fn()
    const view = render(GridSelectionControlledHarness, {
      props: {
        mode: 'multiple',
        value: ['a'],
        sort: { key: 'name', direction: 'asc' },
        multiSortState: [{ key: 'name', direction: 'asc' }],
        filters: { name: 'old' },
        filterValues: { status: ['active'] },
        onChange,
        onSortChange,
        onMultiSortChange,
        onFiltersChange,
        onFilterValuesChange,
        onCore: (value) => (core = value),
        onModel: (value) => (selectionModel = value),
        onSortingModel: (value) => (sortingModel = value),
        onFilteringModel: (value) => (filteringModel = value),
        onSelection: (value) => (selection = value),
        onSort: (value) => (sort = value),
        onMultiSort: (value) => (multiSort = value),
        onFilters: (value) => (filters = value),
        onFilterValues: (value) => (filterValues = value),
        onSelectionEvent: selectionEvent,
        onSortingEvent: sortingEvent,
        onFilteringEvent: filteringEvent,
      },
    })
    await tick()

    const initialSelectionModel = selectionModel
    const initialSortingModel = sortingModel
    const initialFilteringModel = filteringModel
    await view.rerender({
      value: ['b'],
      sort: { key: 'age', direction: 'desc' },
      multiSortState: [{ key: 'status', direction: 'asc' }],
      filters: { status: 'paused' },
      filterValues: { status: ['paused'], region: ['eu'] },
    })
    await tick()

    expect(get(selection)).toEqual(['b'])
    expect(get(sort)).toEqual({ key: 'age', direction: 'desc' })
    expect(get(multiSort)).toEqual([{ key: 'status', direction: 'asc' }])
    expect(get(filters)).toEqual({ status: 'paused' })
    expect(get(filterValues)).toEqual({ status: ['paused'], region: ['eu'] })
    expect(selectionModel.get()).toEqual(['b'])
    expect(sortingModel.get()).toEqual({
      sort: { key: 'age', direction: 'desc' },
      multiSort: [{ key: 'status', direction: 'asc' }],
    })
    expect(filteringModel.get()).toEqual({
      filters: { status: 'paused' },
      filterValues: { status: ['paused'], region: ['eu'] },
    })
    expect(onChange).not.toHaveBeenCalled()
    expect(onSortChange).not.toHaveBeenCalled()
    expect(onMultiSortChange).not.toHaveBeenCalled()
    expect(onFiltersChange).not.toHaveBeenCalled()
    expect(onFilterValuesChange).not.toHaveBeenCalled()
    expect(selectionEvent).not.toHaveBeenCalled()
    expect(sortingEvent).not.toHaveBeenCalled()
    expect(filteringEvent).not.toHaveBeenCalled()
    expect(selectionModel).toBe(initialSelectionModel)
    expect(sortingModel).toBe(initialSortingModel)
    expect(filteringModel).toBe(initialFilteringModel)
    expect(core.invoke<SelectionModel<string>>('getSelectionModel')).toBe(selectionModel)
    expect(core.invoke<GridSortingModel>('getSortingModel')).toBe(sortingModel)
    expect(core.invoke<GridFilteringModel>('getFilteringModel')).toBe(filteringModel)

    await view.rerender({
      value: [],
      sort: null,
      multiSortState: [],
      filters: {},
      filterValues: {},
    })
    await tick()

    expect(get(selection)).toEqual([])
    expect(get(sort)).toBeNull()
    expect(get(multiSort)).toEqual([])
    expect(get(filters)).toEqual({})
    expect(get(filterValues)).toEqual({})
    expect(selectionModel.get()).toEqual([])
    expect(sortingModel.get()).toEqual({ sort: null, multiSort: [] })
    expect(filteringModel.get()).toEqual({ filters: {}, filterValues: {} })
    expect(onChange).not.toHaveBeenCalled()
    expect(onSortChange).not.toHaveBeenCalled()
    expect(onMultiSortChange).not.toHaveBeenCalled()
    expect(onFiltersChange).not.toHaveBeenCalled()
    expect(onFilterValuesChange).not.toHaveBeenCalled()
    expect(selectionEvent).not.toHaveBeenCalled()
    expect(sortingEvent).not.toHaveBeenCalled()
    expect(filteringEvent).not.toHaveBeenCalled()
    view.unmount()
  })

  it('restores accepted controlled snapshots after rejected proposals', async () => {
    let selectionModel!: SelectionModel<string>
    let sortingModel!: GridSortingModel
    let filteringModel!: GridFilteringModel
    let selection!: Readable<string[]>
    let sort!: Readable<SortState | null>
    let multiSort!: Readable<SortState[]>
    let filters!: Readable<Record<string, string>>
    let filterValues!: Readable<GridFilterValues>
    const onChange = vi.fn()
    const onSortChange = vi.fn()
    const onMultiSortChange = vi.fn()
    const onFiltersChange = vi.fn()
    const onFilterValuesChange = vi.fn()
    const selectionEvent = vi.fn()
    const sortingEvent = vi.fn()
    const filteringEvent = vi.fn()
    const view = render(GridSelectionControlledHarness, {
      props: {
        mode: 'multiple',
        value: ['accepted-selection'],
        sort: null,
        multiSortState: [],
        filters: {},
        filterValues: {},
        defaultValue: ['default-selection'],
        defaultSort: { key: 'default-sort', direction: 'asc' },
        defaultMultiSort: [{ key: 'default-multi', direction: 'asc' }],
        defaultFilters: { default: 'filter' },
        defaultFilterValues: { default: ['value'] },
        onChange,
        onSortChange,
        onMultiSortChange,
        onFiltersChange,
        onFilterValuesChange,
        onModel: (value) => (selectionModel = value),
        onSortingModel: (value) => (sortingModel = value),
        onFilteringModel: (value) => (filteringModel = value),
        onSelection: (value) => (selection = value),
        onSort: (value) => (sort = value),
        onMultiSort: (value) => (multiSort = value),
        onFilters: (value) => (filters = value),
        onFilterValues: (value) => (filterValues = value),
        onSelectionEvent: selectionEvent,
        onSortingEvent: sortingEvent,
        onFilteringEvent: filteringEvent,
      },
    })
    await tick()

    selectionModel.toggle('rejected-selection')
    sortingModel.setSort({ key: 'rejected-sort', direction: 'asc' })
    sortingModel.setMultiSort([{ key: 'rejected-multi', direction: 'asc' }])
    filteringModel.setFilters({ rejected: 'filter' })
    filteringModel.setFilterValues({ rejected: ['value'] })
    expect(get(selection)).toEqual(['accepted-selection'])
    expect(get(sort)).toBeNull()
    expect(get(multiSort)).toEqual([])
    expect(get(filters)).toEqual({})
    expect(get(filterValues)).toEqual({})

    vi.clearAllMocks()
    await view.rerender({
      value: undefined,
      sort: undefined,
      multiSortState: undefined,
      filters: undefined,
      filterValues: undefined,
    })
    await tick()

    expect(get(selection)).toEqual(['accepted-selection'])
    expect(get(sort)).toBeNull()
    expect(get(multiSort)).toEqual([])
    expect(get(filters)).toEqual({})
    expect(get(filterValues)).toEqual({})
    expect(selectionModel.get()).toEqual(['accepted-selection'])
    expect(sortingModel.get()).toEqual({ sort: null, multiSort: [] })
    expect(filteringModel.get()).toEqual({ filters: {}, filterValues: {} })
    expect(onChange).not.toHaveBeenCalled()
    expect(onSortChange).not.toHaveBeenCalled()
    expect(onMultiSortChange).not.toHaveBeenCalled()
    expect(onFiltersChange).not.toHaveBeenCalled()
    expect(onFilterValuesChange).not.toHaveBeenCalled()
    expect(selectionEvent).not.toHaveBeenCalled()
    expect(sortingEvent).not.toHaveBeenCalled()
    expect(filteringEvent).not.toHaveBeenCalled()
    view.unmount()
  })

  it('restores the initial uncontrolled snapshots after a controlled detour', async () => {
    let selectionModel!: SelectionModel<string>
    let sortingModel!: GridSortingModel
    let filteringModel!: GridFilteringModel
    let selection!: Readable<string[]>
    let sort!: Readable<SortState | null>
    let multiSort!: Readable<SortState[]>
    let filters!: Readable<Record<string, string>>
    let filterValues!: Readable<GridFilterValues>
    const onChange = vi.fn()
    const onSortChange = vi.fn()
    const onMultiSortChange = vi.fn()
    const onFiltersChange = vi.fn()
    const onFilterValuesChange = vi.fn()
    const view = render(GridSelectionControlledHarness, {
      props: {
        mode: 'multiple',
        defaultValue: ['default-selection'],
        defaultSort: { key: 'default-sort', direction: 'asc' },
        defaultMultiSort: [{ key: 'default-multi', direction: 'asc' }],
        defaultFilters: { default: 'filter' },
        defaultFilterValues: { default: ['value'] },
        onChange,
        onSortChange,
        onMultiSortChange,
        onFiltersChange,
        onFilterValuesChange,
        onModel: (value) => (selectionModel = value),
        onSortingModel: (value) => (sortingModel = value),
        onFilteringModel: (value) => (filteringModel = value),
        onSelection: (value) => (selection = value),
        onSort: (value) => (sort = value),
        onMultiSort: (value) => (multiSort = value),
        onFilters: (value) => (filters = value),
        onFilterValues: (value) => (filterValues = value),
      },
    })
    await tick()

    await view.rerender({
      value: ['accepted-selection'],
      sort: null,
      multiSortState: [],
      filters: {},
      filterValues: {},
    })
    await tick()
    vi.clearAllMocks()

    selectionModel.toggle('rejected-selection')
    sortingModel.setSort({ key: 'rejected-sort', direction: 'asc' })
    sortingModel.setMultiSort([{ key: 'rejected-multi', direction: 'asc' }])
    filteringModel.setFilters({ rejected: 'filter' })
    filteringModel.setFilterValues({ rejected: ['value'] })
    vi.clearAllMocks()

    await view.rerender({
      value: undefined,
      sort: undefined,
      multiSortState: undefined,
      filters: undefined,
      filterValues: undefined,
    })
    await tick()

    expect(get(selection)).toEqual(['default-selection'])
    expect(get(sort)).toEqual({ key: 'default-sort', direction: 'asc' })
    expect(get(multiSort)).toEqual([{ key: 'default-multi', direction: 'asc' }])
    expect(get(filters)).toEqual({ default: 'filter' })
    expect(get(filterValues)).toEqual({ default: ['value'] })
    expect(selectionModel.get()).toEqual(['default-selection'])
    expect(sortingModel.get()).toEqual({
      sort: { key: 'default-sort', direction: 'asc' },
      multiSort: [{ key: 'default-multi', direction: 'asc' }],
    })
    expect(filteringModel.get()).toEqual({
      filters: { default: 'filter' },
      filterValues: { default: ['value'] },
    })
    expect(onChange).not.toHaveBeenCalled()
    expect(onSortChange).not.toHaveBeenCalled()
    expect(onMultiSortChange).not.toHaveBeenCalled()
    expect(onFiltersChange).not.toHaveBeenCalled()
    expect(onFilterValuesChange).not.toHaveBeenCalled()
    view.unmount()
  })

  it('rebases rejected controlled sort cycles from the accepted props', async () => {
    const acceptedSort: SortState = { key: 'name', direction: 'asc' }
    const acceptedMultiSort: SortState[] = [{ key: 'name', direction: 'asc' }]
    const onSortChange = vi.fn()
    const onMultiSortChange = vi.fn()
    const sortingEvents = vi.fn()
    let cycleSort!: (key: string) => void
    let cycleMultiSort!: (key: string) => void
    let sort!: Readable<SortState | null>
    let multiSort!: Readable<SortState[]>

    const view = render(GridSelectionControlledHarness, {
      props: {
        mode: 'multiple',
        sort: acceptedSort,
        multiSortState: acceptedMultiSort,
        onSortChange,
        onMultiSortChange,
        onSortingEvent: sortingEvents,
        onCycleSort: (cycle) => (cycleSort = cycle),
        onCycleMultiSort: (cycle) => (cycleMultiSort = cycle),
        onSort: (value) => (sort = value),
        onMultiSort: (value) => (multiSort = value),
      },
    })
    await tick()

    cycleSort('name')
    cycleSort('name')
    cycleMultiSort('name')
    cycleMultiSort('name')

    expect(onSortChange).toHaveBeenCalledTimes(2)
    expect(onSortChange).toHaveBeenNthCalledWith(1, { key: 'name', direction: 'desc' })
    expect(onSortChange).toHaveBeenNthCalledWith(2, { key: 'name', direction: 'desc' })
    expect(onMultiSortChange).toHaveBeenCalledTimes(2)
    expect(onMultiSortChange).toHaveBeenNthCalledWith(1, [{ key: 'name', direction: 'desc' }])
    expect(onMultiSortChange).toHaveBeenNthCalledWith(2, [{ key: 'name', direction: 'desc' }])
    expect(sortingEvents).toHaveBeenCalledTimes(4)
    expect(get(sort)).toEqual(acceptedSort)
    expect(get(multiSort)).toEqual(acceptedMultiSort)
    expect(view.getByTestId('sort').textContent).toBe(JSON.stringify(acceptedSort))
    expect(view.getByTestId('multi-sort').textContent).toBe(JSON.stringify(acceptedMultiSort))
    view.unmount()
  })
})
