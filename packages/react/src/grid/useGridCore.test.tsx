import * as React from 'react'
import { act, fireEvent, render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import {
  createGridFeature,
  GRID_FILTERING_CHANGE_EVENT,
  GRID_PAGINATION_CHANGE_EVENT,
  GRID_ROWS_CHANGE_EVENT,
  GRID_SELECTION_CHANGE_EVENT,
  GRID_SORTING_CHANGE_EVENT,
  type GridCore,
  type GridFilterValues,
  type GridFilteringModel,
  type GridRowsModel,
  type GridSortingModel,
  type SortState,
} from '@iris-ui-kit/core/grid'
import { useGridCore } from './useGridCore'
import { useGridExpansion } from './useGridExpansion'
import { useGridFiltering } from './useGridFiltering'
import { useGridPagination } from './useGridPagination'
import { useGridRows } from './useGridRows'
import { useGridSelection } from './useGridSelection'
import { useGridSorting } from './useGridSorting'

async function flushTeardown(): Promise<void> {
  await act(async () => Promise.resolve())
}

describe('useGridCore', () => {
  it('bridges ready and dispose to the React mount lifecycle', async () => {
    const ready = vi.fn()
    const dispose = vi.fn()
    let core: GridCore | undefined
    const feature = createGridFeature({
      name: 'lifecycle',
      setup: () => ({ onReady: ready, dispose }),
    })
    function Harness() {
      core = useGridCore({ features: [feature] })
      return null
    }

    const view = render(<Harness />)
    expect(core?.status).toBe('ready')
    expect(ready).toHaveBeenCalledOnce()

    view.unmount()
    await flushTeardown()
    expect(core?.status).toBe('destroyed')
    expect(dispose).toHaveBeenCalledOnce()
  })

  it('survives the StrictMode effect replay without destroying the live core', async () => {
    let core: GridCore | undefined
    function Harness() {
      core = useGridCore()
      return null
    }

    const view = render(
      <React.StrictMode>
        <Harness />
      </React.StrictMode>,
    )
    await flushTeardown()
    expect(core?.status).toBe('ready')

    view.unmount()
    await flushTeardown()
    expect(core?.status).toBe('destroyed')
  })
})

describe('useGridSelection', () => {
  it('bridges an uncontrolled selection feature without duplicating its state', () => {
    const onChange = vi.fn()
    function Harness() {
      const core = useGridCore()
      const selection = useGridSelection(core, { defaultValue: ['a'], onChange })
      return (
        <button type="button" onClick={() => selection.model.toggle('b')}>
          {selection.selection.join(',')}
        </button>
      )
    }

    const view = render(<Harness />)
    fireEvent.click(view.getByRole('button'))

    expect(view.getByRole('button').textContent).toBe('a,b')
    expect(onChange).toHaveBeenLastCalledWith(['a', 'b'])
    view.unmount()
  })

  it('renders controlled state and rebases mutations on the latest prop', () => {
    const onChange = vi.fn()
    function Harness({ value }: { value: string[] }) {
      const core = useGridCore()
      const selection = useGridSelection(core, { value, onChange })
      return (
        <button
          type="button"
          onClick={() => {
            selection.rebase()
            selection.model.toggle('b')
          }}
        >
          {selection.selection.join(',')}
        </button>
      )
    }

    const view = render(<Harness value={['a']} />)
    view.rerender(<Harness value={['c']} />)
    fireEvent.click(view.getByRole('button'))

    expect(view.getByRole('button').textContent).toBe('c')
    expect(onChange).toHaveBeenLastCalledWith(['c', 'b'])
    view.unmount()
  })

  it('does not promote a rejected controlled selection when control is removed', () => {
    const onChange = vi.fn()
    let setControlled!: (value: boolean) => void
    function Harness() {
      const [controlled, updateControlled] = React.useState(false)
      const [value] = React.useState(['a'])
      setControlled = updateControlled
      const core = useGridCore()
      const selection = useGridSelection(core, {
        value: controlled ? value : undefined,
        defaultValue: ['seed'],
        onChange,
      })
      return (
        <button
          type="button"
          onClick={() => {
            selection.rebase()
            selection.model.toggle('b')
          }}
        >
          {selection.selection.join(',')}
        </button>
      )
    }

    const view = render(<Harness />)
    act(() => setControlled(true))
    fireEvent.click(view.getByRole('button'))
    expect(onChange).toHaveBeenLastCalledWith(['a', 'b'])
    expect(view.getByRole('button').textContent).toBe('a')

    act(() => setControlled(false))
    expect(view.getByRole('button').textContent).toBe('seed')
    view.unmount()
  })

  it('keeps selected and expanded bridge snapshots detached from mutable arrays', () => {
    const value = ['a']
    let selectedSnapshot: string[] | undefined
    let expandedSnapshot: string[] | undefined
    function Harness() {
      const core = useGridCore()
      const selection = useGridSelection(core, { value })
      const expansion = useGridExpansion(core, { defaultValue: ['open'] })
      selectedSnapshot ??= selection.selection
      expandedSnapshot ??= expansion.expandedKeys
      return (
        <button
          type="button"
          onClick={() => {
            selection.model.toggle('b')
            expansion.model.toggle('next')
          }}
        >
          {selection.selection.join(',')}|{expansion.expandedKeys.join(',')}
        </button>
      )
    }

    const view = render(<Harness />)
    expandedSnapshot!.push('polluted')
    value.push('mutated')
    fireEvent.click(view.getByRole('button'))

    expect(selectedSnapshot).toEqual(['a'])
    expect(view.getByRole('button').textContent).toBe('a,mutated|open,next')
    view.unmount()
  })

  it('restores the uncontrolled sort after a rejected controlled handoff', () => {
    const A: SortState = { key: 'name', direction: 'asc' }
    const B: SortState = { key: 'age', direction: 'desc' }
    const C: SortState = { key: 'status', direction: 'asc' }
    const onSortChange = vi.fn()
    let setControlled!: React.Dispatch<React.SetStateAction<SortState | undefined>>
    let sorting!: ReturnType<typeof useGridSorting>

    function Harness() {
      const [sort, updateSort] = React.useState<SortState | undefined>()
      setControlled = updateSort
      const core = useGridCore()
      sorting = useGridSorting(core, [], {
        leafColumns: [],
        sort,
        defaultSort: A,
        onSortChange,
      })
      return <output data-testid="sort">{JSON.stringify(sorting.sortState)}</output>
    }

    const view = render(<Harness />)
    expect(sorting.sortState).toEqual(A)

    act(() => setControlled(B))
    expect(sorting.sortState).toEqual(B)
    expect(sorting.model.get().sort).toEqual(B)
    expect(onSortChange).not.toHaveBeenCalled()

    act(() => sorting.model.setSort(C))
    expect(sorting.model.get().sort).toEqual(C)
    expect(sorting.sortState).toEqual(B)
    expect(onSortChange).toHaveBeenLastCalledWith(C)
    const proposalCount = onSortChange.mock.calls.length

    act(() => setControlled(undefined))
    expect(sorting.sortState).toEqual(A)
    expect(sorting.model.get().sort).toEqual(A)
    expect(onSortChange).toHaveBeenCalledTimes(proposalCount)
    expect(view.getByTestId('sort').textContent).toBe(JSON.stringify(A))
    view.unmount()
  })

  it('preserves initial controlled selection and single-sort baselines across a no-op handoff detour', () => {
    const selectionA = ['a']
    const selectionB = ['b']
    const sortA: SortState = { key: 'name', direction: 'asc' }
    const sortB: SortState = { key: 'age', direction: 'desc' }
    const onChange = vi.fn()
    const onSortChange = vi.fn()
    const selectionEvent = vi.fn()
    const sortingEvent = vi.fn()
    let setValue!: React.Dispatch<React.SetStateAction<string[] | undefined>>
    let setSort!: React.Dispatch<React.SetStateAction<SortState | undefined>>
    let selection!: ReturnType<typeof useGridSelection>
    let sorting!: ReturnType<typeof useGridSorting>

    function Harness() {
      const [value, updateValue] = React.useState<string[] | undefined>(selectionA)
      const [sort, updateSort] = React.useState<SortState | undefined>(sortA)
      setValue = updateValue
      setSort = updateSort
      const core = useGridCore()
      selection = useGridSelection(core, { value, onChange })
      sorting = useGridSorting(core, [], { leafColumns: [], sort, onSortChange })
      React.useEffect(() => {
        const unsubscribeSelection = core.on(GRID_SELECTION_CHANGE_EVENT, selectionEvent)
        const unsubscribeSorting = core.on(GRID_SORTING_CHANGE_EVENT, sortingEvent)
        return () => {
          unsubscribeSelection()
          unsubscribeSorting()
        }
      }, [core])
      return null
    }

    const view = render(<Harness />)
    expect(selection.selection).toEqual(selectionA)
    expect(selection.model.get()).toEqual(selectionA)
    expect(sorting.sortState).toEqual(sortA)
    expect(sorting.model.get().sort).toEqual(sortA)
    vi.clearAllMocks()

    act(() => {
      setValue(undefined)
      setSort(undefined)
    })
    expect(selection.selection).toEqual(selectionA)
    expect(selection.model.get()).toEqual(selectionA)
    expect(sorting.sortState).toEqual(sortA)
    expect(sorting.model.get().sort).toEqual(sortA)

    act(() => {
      setValue(selectionB)
      setSort(sortB)
    })
    expect(selection.selection).toEqual(selectionB)
    expect(selection.model.get()).toEqual(selectionB)
    expect(sorting.sortState).toEqual(sortB)
    expect(sorting.model.get().sort).toEqual(sortB)

    act(() => {
      setValue(undefined)
      setSort(undefined)
    })
    expect(selection.selection).toEqual(selectionA)
    expect(selection.model.get()).toEqual(selectionA)
    expect(sorting.sortState).toEqual(sortA)
    expect(sorting.model.get().sort).toEqual(sortA)
    expect(onChange).not.toHaveBeenCalled()
    expect(onSortChange).not.toHaveBeenCalled()
    expect(selectionEvent).not.toHaveBeenCalled()
    expect(sortingEvent).not.toHaveBeenCalled()
    view.unmount()
  })
})

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

describe('useGridRows', () => {
  it.each([undefined, false] as const)(
    'keeps mutable row snapshots detached across commits and silent sync (%s)',
    (cloneDefaultRows) => {
      type Row = { id: number; name: string }
      const initialRows = [{ id: 1, name: 'Ada' }]
      const committedRows = [{ id: 2, name: 'Bea' }]
      const synchronizedRows = [{ id: 3, name: 'Cora' }]
      const before = vi.fn()
      const after = vi.fn()
      let core!: GridCore<Row>
      let bridge!: { model: GridRowsModel<Row>; rows: Row[] }

      function Harness() {
        core = useGridCore<Row>()
        bridge = useGridRows(core, initialRows, {
          cloneDefaultRows,
          onBeforeRowsChange: before,
          onRowsChange: after,
        })
        return null
      }

      const view = render(<Harness />)
      const storeObserver = vi.fn()
      const rowEvent = vi.fn()
      const unsubscribeStore = bridge.model.store.subscribe(storeObserver)
      const unsubscribeEvent = core.on(GRID_ROWS_CHANGE_EVENT, rowEvent)
      before.mockReset()
      after.mockReset()

      const initialSnapshot = bridge.rows
      expect(initialSnapshot).not.toBe(bridge.model.store.getState())
      initialSnapshot.push({ id: 99, name: 'local' })
      initialSnapshot.splice(0, 1)
      expect(bridge.model.get()).toEqual(initialRows)
      expect(core.invoke<Row[]>('getRows')).toEqual(initialRows)
      expect(bridge.model.store.getState()).toEqual(initialRows)
      expect(storeObserver).not.toHaveBeenCalled()
      expect(before).not.toHaveBeenCalled()
      expect(after).not.toHaveBeenCalled()
      expect(rowEvent).not.toHaveBeenCalled()

      act(() => bridge.model.commit(committedRows))
      expect(bridge.rows).toEqual(committedRows)
      expect(bridge.rows).not.toBe(bridge.model.store.getState())
      expect(bridge.rows[0]).toBe(committedRows[0])
      expect(storeObserver).toHaveBeenCalledOnce()
      expect(before).toHaveBeenCalledOnce()
      expect(after).toHaveBeenCalledOnce()
      expect(rowEvent).toHaveBeenCalledOnce()

      const committedSnapshot = bridge.rows
      committedSnapshot.push({ id: 100, name: 'local' })
      committedSnapshot.splice(0, 1)
      expect(bridge.model.get()).toEqual(committedRows)
      expect(core.invoke<Row[]>('getRows')).toEqual(committedRows)
      expect(bridge.model.store.getState()).toEqual(committedRows)
      expect(storeObserver).toHaveBeenCalledOnce()
      expect(before).toHaveBeenCalledOnce()
      expect(after).toHaveBeenCalledOnce()
      expect(rowEvent).toHaveBeenCalledOnce()

      act(() => bridge.model.sync(synchronizedRows))
      expect(bridge.rows).toEqual(synchronizedRows)
      expect(bridge.rows).not.toBe(bridge.model.store.getState())
      expect(bridge.model.get()).toEqual(synchronizedRows)
      expect(core.invoke<Row[]>('getRows')).toEqual(synchronizedRows)
      expect(storeObserver).toHaveBeenCalledTimes(2)
      expect(before).toHaveBeenCalledOnce()
      expect(after).toHaveBeenCalledOnce()
      expect(rowEvent).toHaveBeenCalledOnce()

      unsubscribeStore()
      unsubscribeEvent()
      view.unmount()
    },
  )

  it('renders committed rows while silent sync skips transaction observers', () => {
    const before = vi.fn()
    const after = vi.fn()
    function Harness() {
      const core = useGridCore<{ name: string }>()
      const rows = useGridRows(core, [{ name: 'Ada' }], {
        onBeforeRowsChange: before,
        onRowsChange: after,
      })
      return (
        <div>
          <span>{rows.rows.map((row) => row.name).join(',')}</span>
          <button type="button" onClick={() => rows.model.commit([{ name: 'Bob' }])}>
            commit
          </button>
          <button type="button" onClick={() => rows.model.sync([{ name: 'Cora' }])}>
            sync
          </button>
        </div>
      )
    }

    const view = render(<Harness />)
    fireEvent.click(view.getByRole('button', { name: 'commit' }))
    expect(view.getByText('Bob')).toBeTruthy()
    expect(before).toHaveBeenCalledOnce()
    expect(after).toHaveBeenCalledOnce()

    fireEvent.click(view.getByRole('button', { name: 'sync' }))
    expect(view.getByText('Cora')).toBeTruthy()
    expect(before).toHaveBeenCalledOnce()
    expect(after).toHaveBeenCalledOnce()
    view.unmount()
  })

  it('uses rowKeyField for key-addressed mutations through the React bridge', () => {
    type Row = { id: number; code: string; name: string }
    function Harness() {
      const core = useGridCore<Row>()
      const rows = useGridRows(core, [{ id: 1, code: 'ada', name: 'Ada' }], {
        rowKeyField: 'code',
      })
      return (
        <div>
          <span data-testid="field-rows">{rows.rows.map((row) => row.name).join(',')}</span>
          <button type="button" onClick={() => rows.model.update('ada', { name: 'Alicia' })}>
            update field key
          </button>
          <button type="button" onClick={() => rows.model.remove('ada')}>
            remove field key
          </button>
        </div>
      )
    }

    const view = render(<Harness />)
    fireEvent.click(view.getByRole('button', { name: 'update field key' }))
    expect(view.getByTestId('field-rows').textContent).toBe('Alicia')
    fireEvent.click(view.getByRole('button', { name: 'remove field key' }))
    expect(view.getByTestId('field-rows').textContent).toBe('')
    view.unmount()
  })

  it('uses getRowKey for computed key mutations through the React bridge', () => {
    type Row = { id: number; code: string; name: string }
    function Harness() {
      const core = useGridCore<Row>()
      const rows = useGridRows(core, [{ id: 1, code: 'ada', name: 'Ada' }], {
        getRowKey: (row, index) => `${row.code}:${index}`,
      })
      return (
        <div>
          <span data-testid="computed-rows">{rows.rows.map((row) => row.name).join(',')}</span>
          <button type="button" onClick={() => rows.model.update('ada:0', { name: 'Alicia' })}>
            update computed key
          </button>
          <button type="button" onClick={() => rows.model.remove('ada:0')}>
            remove computed key
          </button>
        </div>
      )
    }

    const view = render(<Harness />)
    fireEvent.click(view.getByRole('button', { name: 'update computed key' }))
    expect(view.getByTestId('computed-rows').textContent).toBe('Alicia')
    fireEvent.click(view.getByRole('button', { name: 'remove computed key' }))
    expect(view.getByTestId('computed-rows').textContent).toBe('')
    view.unmount()
  })

  it('routes nested row mutations through tree accessors', () => {
    type TreeRow = { id: number; name: string; children?: TreeRow[] }
    function Harness() {
      const core = useGridCore<TreeRow>()
      const rows = useGridRows(
        core,
        [{ id: 1, name: 'Root', children: [{ id: 2, name: 'Child' }] }],
        { getChildren: (row) => row.children },
      )
      return (
        <div>
          <span data-testid="tree-child">{rows.rows[0]?.children?.[0]?.name ?? ''}</span>
          <button type="button" onClick={() => rows.model.update(2, { name: 'Updated' })}>
            update nested
          </button>
          <button type="button" onClick={() => rows.model.remove(2)}>
            remove nested
          </button>
        </div>
      )
    }

    const view = render(<Harness />)
    fireEvent.click(view.getByRole('button', { name: 'update nested' }))
    expect(view.getByTestId('tree-child').textContent).toBe('Updated')
    fireEvent.click(view.getByRole('button', { name: 'remove nested' }))
    expect(view.getByTestId('tree-child').textContent).toBe('')
    view.unmount()
  })
})

describe('useGridPagination', () => {
  it('hides rejected proposals and restores accepted or uncontrolled snapshots on handoff', () => {
    const onChange = vi.fn()
    const paginationEvent = vi.fn()
    let setPage!: React.Dispatch<React.SetStateAction<number | undefined>>
    let pagination!: ReturnType<typeof useGridPagination>
    let core!: GridCore

    function Harness({ page, defaultPage }: { page?: number; defaultPage?: number }) {
      core = useGridCore()
      React.useEffect(() => core.on(GRID_PAGINATION_CHANGE_EVENT, paginationEvent), [core])
      pagination = useGridPagination(core, {
        page,
        defaultPage,
        pageSize: 25,
        total: 101,
        onChange,
      })
      return <output data-testid="pagination">{pagination.pagination.page}</output>
    }

    function ControlledParent() {
      const [page, updatePage] = React.useState<number | undefined>(1)
      setPage = updatePage
      return <Harness page={page} />
    }

    const view = render(<ControlledParent />)
    expect(view.getByTestId('pagination').textContent).toBe('1')

    act(() => pagination.setPage(2))
    expect(view.getByTestId('pagination').textContent).toBe('1')
    expect(onChange).toHaveBeenCalledOnce()
    expect(onChange).toHaveBeenLastCalledWith({ page: 2, pageSize: 25, reason: 'page' })
    expect(paginationEvent).toHaveBeenCalledOnce()
    expect(paginationEvent).toHaveBeenLastCalledWith({
      page: 2,
      pageSize: 25,
      reason: 'page',
    })

    act(() => setPage(1))
    expect(view.getByTestId('pagination').textContent).toBe('1')
    expect(onChange).toHaveBeenCalledOnce()
    expect(paginationEvent).toHaveBeenCalledOnce()

    act(() => setPage(3))
    expect(view.getByTestId('pagination').textContent).toBe('3')
    expect(pagination.model.get().page).toBe(3)
    expect(onChange).toHaveBeenCalledOnce()
    expect(paginationEvent).toHaveBeenCalledOnce()

    act(() => pagination.setPage(4))
    expect(view.getByTestId('pagination').textContent).toBe('3')
    expect(onChange).toHaveBeenCalledTimes(2)
    expect(paginationEvent).toHaveBeenCalledTimes(2)

    act(() => setPage(undefined))
    expect(view.getByTestId('pagination').textContent).toBe('3')
    expect(pagination.model.get().page).toBe(3)
    expect(onChange).toHaveBeenCalledTimes(2)
    expect(paginationEvent).toHaveBeenCalledTimes(2)
    view.unmount()

    onChange.mockClear()
    paginationEvent.mockClear()
    let setDetourPage!: React.Dispatch<React.SetStateAction<number | undefined>>

    function UncontrolledDetourParent() {
      const [page, updatePage] = React.useState<number | undefined>()
      setDetourPage = updatePage
      return <Harness page={page} defaultPage={7} />
    }

    const detourView = render(<UncontrolledDetourParent />)
    expect(detourView.getByTestId('pagination').textContent).toBe('7')
    act(() => setDetourPage(1))
    expect(detourView.getByTestId('pagination').textContent).toBe('1')
    act(() => pagination.setPage(2))
    expect(detourView.getByTestId('pagination').textContent).toBe('1')
    act(() => setDetourPage(undefined))
    expect(detourView.getByTestId('pagination').textContent).toBe('7')
    expect(pagination.model.get().page).toBe(7)
    expect(onChange).toHaveBeenCalledOnce()
    expect(paginationEvent).toHaveBeenCalledOnce()
    detourView.unmount()
  })

  it('bridges controlled proxy state and resets the page when pageSize changes', () => {
    const onChange = vi.fn()
    function Harness({ page, pageSize }: { page: number; pageSize: number }) {
      const core = useGridCore()
      const pagination = useGridPagination(core, { page, pageSize, total: 101, onChange })
      return (
        <button type="button" onClick={() => pagination.setPageSize(50)}>
          {pagination.pagination.page}/{pagination.pagination.pageSize}/
          {pagination.pagination.total}
        </button>
      )
    }

    const view = render(<Harness page={3} pageSize={25} />)
    fireEvent.click(view.getByRole('button'))

    expect(view.getByRole('button').textContent).toBe('3/25/101')
    expect(onChange).toHaveBeenLastCalledWith({ page: 1, pageSize: 50, reason: 'pageSize' })
    view.unmount()
  })
})

describe('Grid feature teardown', () => {
  it('keeps retained feature models usable after the React owner unmounts', async () => {
    type Row = { id: number; name: string; status: string }
    const onBeforeRowsChange = vi.fn()
    const onRowsChange = vi.fn()
    const onSortChange = vi.fn()
    const onMultiSortChange = vi.fn()
    const onFiltersChange = vi.fn()
    const onFilterValuesChange = vi.fn()
    const rowEvent = vi.fn()
    const sortingEvent = vi.fn()
    const filteringEvent = vi.fn()
    let rowsModel: GridRowsModel<Row> | undefined
    let sortingModel: GridSortingModel | undefined
    let filteringModel: GridFilteringModel | undefined

    function Harness() {
      const core = useGridCore<Row>()
      const rows = useGridRows(core, [{ id: 1, name: 'Ada', status: 'active' }], {
        onBeforeRowsChange,
        onRowsChange,
      })
      const sorting = useGridSorting(core, rows.rows, {
        leafColumns: [
          { key: 'name', sortable: true },
          { key: 'status', sortable: true },
        ],
        multiSort: true,
        onSortChange,
        onMultiSortChange,
      })
      const filtering = useGridFiltering(core, rows.rows, {
        columns: [{ key: 'name' }, { key: 'status' }],
        getValue: (row, column) => row[column.key as keyof Row],
        onFiltersChange,
        onFilterValuesChange,
      })
      rowsModel = rows.model
      sortingModel = sorting.model
      filteringModel = filtering.model

      React.useEffect(() => {
        core.on(GRID_ROWS_CHANGE_EVENT, rowEvent)
        core.on(GRID_SORTING_CHANGE_EVENT, sortingEvent)
        core.on(GRID_FILTERING_CHANGE_EVENT, filteringEvent)
      }, [core])
      return null
    }

    const view = render(<Harness />)
    await flushTeardown()
    act(() => {
      rowsModel!.commit([{ id: 2, name: 'Bea', status: 'paused' }])
      sortingModel!.setSort({ key: 'name', direction: 'asc' })
      sortingModel!.setMultiSort([{ key: 'status', direction: 'asc' }])
      filteringModel!.setFilter('name', 'a')
      filteringModel!.setColumnFilterValues('status', ['active'])
    })

    expect(onBeforeRowsChange).toHaveBeenCalledOnce()
    expect(onRowsChange).toHaveBeenCalledOnce()
    expect(onSortChange).toHaveBeenCalledOnce()
    expect(onMultiSortChange).toHaveBeenCalledOnce()
    expect(onFiltersChange).toHaveBeenCalledOnce()
    expect(onFilterValuesChange).toHaveBeenCalledOnce()
    expect(rowEvent).toHaveBeenCalledOnce()
    expect(sortingEvent).toHaveBeenCalledTimes(2)
    expect(filteringEvent).toHaveBeenCalledTimes(2)

    view.unmount()
    await flushTeardown()
    act(() => {
      rowsModel!.commit([{ id: 3, name: 'Cora', status: 'active' }])
      sortingModel!.setSort({ key: 'name', direction: 'desc' })
      sortingModel!.setMultiSort([{ key: 'status', direction: 'desc' }])
      filteringModel!.setFilter('name', 'b')
      filteringModel!.setColumnFilterValues('status', ['paused'])
      filteringModel!.clear()
    })

    expect(rowsModel!.getData()).toEqual([{ id: 3, name: 'Cora', status: 'active' }])
    expect(sortingModel!.get()).toEqual({
      sort: { key: 'name', direction: 'desc' },
      multiSort: [{ key: 'status', direction: 'desc' }],
    })
    expect(filteringModel!.get()).toEqual({ filters: {}, filterValues: {} })
    expect(onBeforeRowsChange).toHaveBeenCalledOnce()
    expect(onRowsChange).toHaveBeenCalledOnce()
    expect(onSortChange).toHaveBeenCalledOnce()
    expect(onMultiSortChange).toHaveBeenCalledOnce()
    expect(onFiltersChange).toHaveBeenCalledOnce()
    expect(onFilterValuesChange).toHaveBeenCalledOnce()
    expect(rowEvent).toHaveBeenCalledOnce()
    expect(sortingEvent).toHaveBeenCalledTimes(2)
    expect(filteringEvent).toHaveBeenCalledTimes(2)
  })
})

describe('composed Grid features', () => {
  it('loads rows, selection, expansion, sorting, filtering, and pagination into one core', () => {
    const onExpand = vi.fn()
    let seenCore: GridCore | undefined
    function Harness() {
      const core = useGridCore()
      seenCore = core
      const rows = useGridRows(core, [{ name: 'b' }, { name: 'a' }])
      const selection = useGridSelection(core, { defaultValue: ['selected'] })
      const expansion = useGridExpansion(core, { defaultValue: ['open'], onChange: onExpand })
      const sorting = useGridSorting(core, rows.rows, {
        leafColumns: [{ key: 'name', sortable: true }],
        defaultSort: { key: 'name', direction: 'asc' },
      })
      const filtering = useGridFiltering(core, sorting.sortedData, {
        columns: [{ key: 'name' }],
        getValue: (row, column) => row[column.key],
        defaultFilters: { name: 'a' },
      })
      const pagination = useGridPagination(core, { defaultPageSize: 25, defaultTotal: 51 })
      return (
        <button
          type="button"
          onClick={() => {
            expansion.model.toggle('next')
            pagination.setPage(2)
          }}
        >
          {selection.selection.join(',')}|{expansion.expandedKeys.join(',')}|
          {filtering.filteredData.map((row) => row.name).join(',')}|{pagination.pagination.page}
        </button>
      )
    }

    const view = render(<Harness />)
    expect(seenCore?.features).toEqual([
      'rows',
      'selection',
      'expansion',
      'sorting',
      'filtering',
      'pagination',
    ])
    fireEvent.click(view.getByRole('button'))

    expect(view.getByRole('button').textContent).toBe('selected|open,next|a|2')
    expect(onExpand).toHaveBeenLastCalledWith(['open', 'next'])
    view.unmount()
  })
})
