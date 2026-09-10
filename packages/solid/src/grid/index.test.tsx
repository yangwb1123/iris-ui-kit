import { cleanup, fireEvent, render, renderHook, waitFor } from '@solidjs/testing-library'
import { createSignal } from 'solid-js'
import { describe, expect, it, afterEach, vi } from 'vitest'
import {
  GRID_COLUMNS_CHANGE_EVENT,
  GRID_FILTERING_CHANGE_EVENT,
  GRID_PAGINATION_CHANGE_EVENT,
  GRID_SELECTION_CHANGE_EVENT,
  GRID_SORTING_CHANGE_EVENT,
  type GridColumnsChange,
  type GridColumnsModel,
  type GridCore,
  type GridFilterValues,
  type SortState,
} from '@iris-ui-kit/core/grid'
import {
  useGridColumns,
  useGridCore,
  useGridFiltering,
  useGridPagination,
  useGridRows,
  useGridSelection,
  useGridSorting,
  useGridVirtual,
} from './index'

afterEach(cleanup)

describe('Solid Grid Core bridge', () => {
  it('preserves initial controlled selection and single-sort baselines across a no-op handoff detour', async () => {
    const selectionA = ['a']
    const selectionB = ['b']
    const sortA: SortState = { key: 'name', direction: 'asc' }
    const sortB: SortState = { key: 'age', direction: 'desc' }
    const onChange = vi.fn()
    const onSortChange = vi.fn()
    const selectionEvent = vi.fn()
    const sortingEvent = vi.fn()
    let setValue!: (value: string[] | undefined) => void
    let setSort!: (value: SortState | undefined) => void
    let selection!: ReturnType<typeof useGridSelection>
    let sorting!: ReturnType<typeof useGridSorting>

    type Props = {
      value?: string[]
      sort?: SortState
      onChange: (keys: string[]) => void
      onSortChange: (sort: SortState | null) => void
    }
    const Harness = (props: Props) => {
      const core = useGridCore()
      selection = useGridSelection(core, props)
      sorting = useGridSorting(core, props)
      core.on(GRID_SELECTION_CHANGE_EVENT, selectionEvent)
      core.on(GRID_SORTING_CHANGE_EVENT, sortingEvent)
      return <div />
    }
    const Parent = () => {
      const [value, updateValue] = createSignal<string[] | undefined>(selectionA)
      const [sort, updateSort] = createSignal<SortState | undefined>(sortA)
      setValue = updateValue
      setSort = updateSort
      return (
        <Harness value={value()} sort={sort()} onChange={onChange} onSortChange={onSortChange} />
      )
    }

    const view = render(() => <Parent />)
    expect(selection.selection()).toEqual(selectionA)
    expect(selection.model.get()).toEqual(selectionA)
    expect(sorting.sort()).toEqual(sortA)
    expect(sorting.model.get().sort).toEqual(sortA)
    vi.clearAllMocks()

    setValue(undefined)
    setSort(undefined)
    await waitFor(() => {
      expect(selection.selection()).toEqual(selectionA)
      expect(selection.model.get()).toEqual(selectionA)
      expect(sorting.sort()).toEqual(sortA)
      expect(sorting.model.get().sort).toEqual(sortA)
    })

    setValue(selectionB)
    setSort(sortB)
    await waitFor(() => {
      expect(selection.selection()).toEqual(selectionB)
      expect(selection.model.get()).toEqual(selectionB)
      expect(sorting.sort()).toEqual(sortB)
      expect(sorting.model.get().sort).toEqual(sortB)
    })

    setValue(undefined)
    setSort(undefined)
    await waitFor(() => {
      expect(selection.selection()).toEqual(selectionA)
      expect(selection.model.get()).toEqual(selectionA)
      expect(sorting.sort()).toEqual(sortA)
      expect(sorting.model.get().sort).toEqual(sortA)
    })
    expect(onChange).not.toHaveBeenCalled()
    expect(onSortChange).not.toHaveBeenCalled()
    expect(selectionEvent).not.toHaveBeenCalled()
    expect(sortingEvent).not.toHaveBeenCalled()
    view.unmount()
  })

  it('uses one core instance for rows + selection through Solid signals', () => {
    const { result } = renderHook(() => {
      const core = useGridCore<{ id: string }>()
      const rows = useGridRows(core, [{ id: 'a' }, { id: 'b' }])
      const selection = useGridSelection<{ id: string }, string>(core, { defaultValue: ['a'] })
      const virtual = useGridVirtual(core, {
        items: rows.rows(),
        estimateSize: 20,
        viewportSize: 20,
        getItemKey: (item) => item.id,
      })
      return { core, rows, selection, virtual }
    })

    expect(result.core.status).toBe('ready')
    expect(result.rows.rows()).toHaveLength(2)
    expect(result.selection.selection()).toEqual(['a'])
    expect(result.virtual.state().totalSize).toBe(40)
    result.selection.model.toggle('b')
    expect(result.selection.selection()).toEqual(['a', 'b'])
  })

  it('isolates virtual snapshots while preserving scroll windows', async () => {
    const { result } = renderHook(() => {
      const core = useGridCore<{ id: string }>()
      const virtual = useGridVirtual(core, {
        items: Array.from({ length: 5 }, (_, index) => ({ id: String(index) })),
        estimateSize: 20,
        viewportSize: 40,
        buffer: 0,
      })
      return { core, virtual }
    })
    const model = result.virtual.model
    const initial = result.virtual.state()
    const internal = model.store.getState()
    const expectWindow = (state: typeof initial, indexes: number[], starts: number[]) => {
      expect(state.totalSize).toBe(100)
      expect(state.items.map((item) => item.index)).toEqual(indexes)
      expect(state.items.map((item) => item.start)).toEqual(starts)
      expect(state.items.every((item) => item.size === 20)).toBe(true)
    }

    expect(model).toBe(result.core.invoke('getVirtualModel'))
    expect(initial).not.toBe(internal)
    expect(initial.items).not.toBe(internal.items)
    expect(initial.items[0]).not.toBe(internal.items[0])
    expectWindow(initial, [0, 1], [0, 20])

    initial.offsetBefore = 999
    initial.totalSize = 999
    initial.startIndex = 999
    initial.endIndex = 999
    initial.items[0]!.start = 999
    initial.items[0]!.size = 999
    initial.items.length = 0
    expectWindow(model.store.getState(), [0, 1], [0, 20])
    expectWindow(model.getState(), [0, 1], [0, 20])

    model.setScroll(20)
    await waitFor(() => expectWindow(result.virtual.state(), [1, 2], [20, 40]))

    const emitted = result.virtual.state()
    emitted.offsetBefore = 999
    emitted.totalSize = 999
    emitted.items[0]!.start = 999
    emitted.items.length = 0
    expectWindow(model.store.getState(), [1, 2], [20, 40])
    expectWindow(model.getState(), [1, 2], [20, 40])

    model.setScroll(40)
    await waitFor(() => expectWindow(result.virtual.state(), [2, 3], [40, 60]))
  })

  it('hands controlled pagination changes from props into the core model', () => {
    let setPage!: (page: number) => void
    const Harness = (props: { page: number; total: number }) => {
      const core = useGridCore()
      const pagination = useGridPagination(core, props)
      return <output data-testid="page">{pagination.pagination().page}</output>
    }
    const Parent = () => {
      const [page, updatePage] = createSignal(1)
      setPage = updatePage
      return <Harness page={page()} total={20} />
    }

    const view = render(() => <Parent />)
    expect(view.getByTestId('page').textContent).toBe('1')
    setPage(2)
    expect(view.getByTestId('page').textContent).toBe('2')
  })

  it('hides rejected pagination proposals and restores accepted snapshots on handoff', async () => {
    type Props = {
      page?: number
      defaultPage?: number
      pageSize?: number
      total?: number
      onChange: (change: unknown) => void
    }
    const onChange = vi.fn()
    const paginationEvent = vi.fn()
    let setPage!: (page: number | undefined) => void
    let pagination!: ReturnType<typeof useGridPagination>

    const Harness = (props: Props) => {
      const core = useGridCore()
      core.on(GRID_PAGINATION_CHANGE_EVENT, paginationEvent)
      pagination = useGridPagination(core, props)
      return <output data-testid="page">{pagination.pagination().page}</output>
    }
    const Parent = () => {
      const [page, updatePage] = createSignal<number | undefined>(1)
      setPage = updatePage
      return <Harness page={page()} pageSize={25} total={101} onChange={onChange} />
    }

    const view = render(() => <Parent />)
    expect(view.getByTestId('page').textContent).toBe('1')

    pagination.model.setPage(2)
    await waitFor(() => expect(view.getByTestId('page').textContent).toBe('1'))
    expect(onChange).toHaveBeenCalledOnce()
    expect(paginationEvent).toHaveBeenCalledOnce()

    setPage(3)
    await waitFor(() => expect(view.getByTestId('page').textContent).toBe('3'))
    pagination.model.setPage(4)
    await waitFor(() => expect(view.getByTestId('page').textContent).toBe('3'))
    expect(onChange).toHaveBeenCalledTimes(2)
    expect(paginationEvent).toHaveBeenCalledTimes(2)

    setPage(undefined)
    await waitFor(() => {
      expect(view.getByTestId('page').textContent).toBe('3')
      expect(pagination.model.get().page).toBe(3)
    })
    expect(onChange).toHaveBeenCalledTimes(2)
    expect(paginationEvent).toHaveBeenCalledTimes(2)
  })

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

  it('restores the uncontrolled sort after a rejected controlled handoff', async () => {
    const A: SortState = { key: 'name', direction: 'asc' }
    const B: SortState = { key: 'age', direction: 'desc' }
    const C: SortState = { key: 'status', direction: 'asc' }
    const onSortChange = vi.fn()
    let setControlled!: (value: SortState | undefined) => void
    let sorting!: ReturnType<typeof useGridSorting>

    const Harness = (props: {
      sort?: SortState
      defaultSort: SortState
      onSortChange: (sort: SortState | null) => void
    }) => {
      const core = useGridCore()
      sorting = useGridSorting(core, props)
      return <output data-testid="sort">{JSON.stringify(sorting.sort())}</output>
    }
    const Parent = () => {
      const [sort, updateSort] = createSignal<SortState | undefined>()
      setControlled = updateSort
      return <Harness sort={sort()} defaultSort={A} onSortChange={onSortChange} />
    }

    const view = render(() => <Parent />)
    expect(sorting.sort()).toEqual(A)

    setControlled(B)
    await waitFor(() => {
      expect(sorting.sort()).toEqual(B)
      expect(sorting.model.get().sort).toEqual(B)
    })
    expect(onSortChange).not.toHaveBeenCalled()

    sorting.model.setSort(C)
    expect(sorting.model.get().sort).toEqual(C)
    expect(sorting.sort()).toEqual(B)
    expect(onSortChange).toHaveBeenLastCalledWith(C)
    const proposalCount = onSortChange.mock.calls.length

    setControlled(undefined)
    await waitFor(() => {
      expect(sorting.sort()).toEqual(A)
      expect(sorting.model.get().sort).toEqual(A)
      expect(view.getByTestId('sort').textContent).toBe(JSON.stringify(A))
    })
    expect(onSortChange).toHaveBeenCalledTimes(proposalCount)
    view.unmount()
  })

  it('keeps uncontrolled Grid defaults and model mutations intact', () => {
    const onChange = vi.fn()
    const onSortChange = vi.fn()
    const onMultiSortChange = vi.fn()
    const onFiltersChange = vi.fn()
    const onFilterValuesChange = vi.fn()
    let selection!: ReturnType<typeof useGridSelection>
    let sorting!: ReturnType<typeof useGridSorting>
    let filtering!: ReturnType<typeof useGridFiltering>

    const Harness = () => {
      const core = useGridCore()
      selection = useGridSelection(core, { defaultValue: ['a'], onChange })
      sorting = useGridSorting(core, {
        mode: 'multiple',
        defaultSort: { key: 'name', direction: 'asc' },
        defaultMultiSort: [{ key: 'status', direction: 'asc' }],
        onSortChange,
        onMultiSortChange,
      })
      filtering = useGridFiltering(core, {
        defaultFilters: { name: 'old' },
        defaultFilterValues: { status: ['active'] },
        onFiltersChange,
        onFilterValuesChange,
      })
      return <div />
    }

    const view = render(() => <Harness />)
    expect(selection.model.get()).toEqual(['a'])
    expect(sorting.model.get()).toEqual({
      sort: { key: 'name', direction: 'asc' },
      multiSort: [{ key: 'status', direction: 'asc' }],
    })
    expect(filtering.model.get()).toEqual({
      filters: { name: 'old' },
      filterValues: { status: ['active'] },
    })

    selection.model.toggle('b')
    sorting.model.cycleSort('name')
    sorting.model.cycleMultiSort('status')
    filtering.model.setFilter('status', 'paused')
    filtering.model.setColumnFilterValues('region', ['eu'])

    expect(selection.model.get()).toEqual(['a', 'b'])
    expect(sorting.model.get()).toEqual({
      sort: { key: 'name', direction: 'desc' },
      multiSort: [{ key: 'status', direction: 'desc' }],
    })
    expect(filtering.model.get()).toEqual({
      filters: { name: 'old', status: 'paused' },
      filterValues: { status: ['active'], region: ['eu'] },
    })
    expect(onChange).toHaveBeenCalledWith(['a', 'b'])
    expect(onSortChange).toHaveBeenCalledWith({ key: 'name', direction: 'desc' })
    expect(onMultiSortChange).toHaveBeenCalledWith([{ key: 'status', direction: 'desc' }])
    expect(onFiltersChange).toHaveBeenCalledWith({ name: 'old', status: 'paused' })
    expect(onFilterValuesChange).toHaveBeenCalledWith({ status: ['active'], region: ['eu'] })
    view.unmount()
  })

  it('restores the uncontrolled visibility snapshot across rejected control handoff', async () => {
    let setVisibility!: (value: Record<string, boolean> | undefined) => void
    let toggleVisibility!: () => void
    const Harness = (props: {
      visibility?: Record<string, boolean>
      defaultVisibility: Record<string, boolean>
    }) => {
      const core = useGridCore()
      const columns = useGridColumns(core, props)
      toggleVisibility = () => columns.toggleVisibility('age')
      return <output data-testid="visibility">{String(columns.state().visibility.age)}</output>
    }
    const Parent = () => {
      const [visibility, updateVisibility] = createSignal<Record<string, boolean> | undefined>({
        age: false,
      })
      setVisibility = updateVisibility
      return <Harness visibility={visibility()} defaultVisibility={{ age: false }} />
    }

    const view = render(() => <Parent />)
    expect(view.getByTestId('visibility').textContent).toBe('false')

    toggleVisibility()
    await waitFor(() => expect(view.getByTestId('visibility').textContent).toBe('false'))

    setVisibility(undefined)
    await waitFor(() => expect(view.getByTestId('visibility').textContent).toBe('false'))

    setVisibility({ age: true })
    await waitFor(() => expect(view.getByTestId('visibility').textContent).toBe('true'))
    setVisibility(undefined)
    await waitFor(() => expect(view.getByTestId('visibility').textContent).toBe('false'))
    view.unmount()
  })

  it('isolates all column snapshots and restores each uncontrolled channel after handoff', async () => {
    let columns!: ReturnType<typeof useGridColumns>
    let setVisibility!: (value: Record<string, boolean> | undefined) => void
    let setOrder!: (value: string[] | undefined) => void
    let setWidths!: (value: Record<string, number> | undefined) => void
    let setPinned!: (value: Record<string, 'left' | 'right' | null> | undefined) => void
    const Harness = (props: {
      visibility?: Record<string, boolean>
      order?: string[]
      widths?: Record<string, number>
      pinned?: Record<string, 'left' | 'right' | null>
      defaultVisibility: Record<string, boolean>
      defaultOrder: string[]
      defaultWidths: Record<string, number>
      defaultPinned: Record<string, 'left' | 'right' | null>
    }) => {
      const core = useGridCore()
      columns = useGridColumns(core, props)
      return (
        <>
          <output data-testid="state">{JSON.stringify(columns.state())}</output>
          <button
            type="button"
            onClick={() => {
              columns.setVisibility({ age: true })
              columns.setOrder(['age', 'name'])
              columns.setWidths({ name: 116 })
              columns.setPinned('name', null)
            }}
          >
            edit
          </button>
        </>
      )
    }
    const Parent = () => {
      const [visibility, updateVisibility] = createSignal<Record<string, boolean> | undefined>()
      const [order, updateOrder] = createSignal<string[] | undefined>()
      const [widths, updateWidths] = createSignal<Record<string, number> | undefined>()
      const [pinned, updatePinned] = createSignal<
        Record<string, 'left' | 'right' | null> | undefined
      >()
      setVisibility = updateVisibility
      setOrder = updateOrder
      setWidths = updateWidths
      setPinned = updatePinned
      return (
        <Harness
          visibility={visibility()}
          order={order()}
          widths={widths()}
          pinned={pinned()}
          defaultVisibility={{ age: false }}
          defaultOrder={['name', 'age']}
          defaultWidths={{ name: 100 }}
          defaultPinned={{ name: 'left' }}
        />
      )
    }
    const view = render(() => <Parent />)
    fireEvent.click(view.getByRole('button', { name: 'edit' }))
    expect(columns.model.get()).toMatchObject({
      visibility: { age: true },
      order: ['age', 'name'],
      widths: { name: 116 },
      pinned: { name: null },
    })

    const controlled = {
      visibility: { age: false },
      order: ['name'],
      widths: { name: 310 },
      pinned: { name: 'right' as 'left' | 'right' | null },
    }
    setVisibility(controlled.visibility)
    setOrder(controlled.order)
    setWidths(controlled.widths)
    setPinned(controlled.pinned)
    await waitFor(() => expect(columns.model.get()).toMatchObject(controlled))

    const snapshot = columns.state()
    snapshot.visibility.age = true
    snapshot.order.push('mutated')
    snapshot.widths.name = 999
    snapshot.pinned.name = 'left'
    expect(columns.model.get()).toMatchObject(controlled)

    controlled.visibility.age = true
    controlled.order.push('mutated-input')
    controlled.widths.name = 998
    controlled.pinned.name = 'left'
    expect(columns.model.get()).toMatchObject({
      visibility: { age: false },
      order: ['name'],
      widths: { name: 310 },
      pinned: { name: 'right' },
    })

    setVisibility(undefined)
    setOrder(undefined)
    setWidths(undefined)
    setPinned(undefined)
    await waitFor(() =>
      expect(columns.model.get()).toMatchObject({
        visibility: { age: true },
        order: ['age', 'name'],
        widths: { name: 116 },
        pinned: { name: null },
      }),
    )
    view.unmount()
  })

  it('routes nested row mutations through tree accessors', () => {
    type TreeRow = { id: number; name: string; children?: TreeRow[] }
    const { result } = renderHook(() => {
      const core = useGridCore<TreeRow>()
      const rows = useGridRows(
        core,
        [{ id: 1, name: 'Root', children: [{ id: 2, name: 'Child' }] }],
        { getChildren: (row) => row.children },
      )
      return rows
    })

    expect(result.rows()[0]?.children?.[0]?.name).toBe('Child')
    expect(result.model.update(2, { name: 'Updated' })).toBe(true)
    expect(result.rows()[0]?.children?.[0]?.name).toBe('Updated')
    expect(result.model.remove(2)).toBe(true)
    expect(result.rows()[0]?.children).toEqual([])
  })

  it('installs one columns model, keeps inbound sync silent, and routes writes', () => {
    let core: GridCore<{ id: string }> | undefined
    let columns: ReturnType<typeof useGridColumns> | undefined
    const onVisibilityChange = vi.fn()
    const onWidthsChange = vi.fn()
    const events: GridColumnsChange[] = []

    const Harness = () => {
      core = useGridCore<{ id: string }>()
      columns = useGridColumns(core, { onVisibilityChange, onWidthsChange })
      return <div />
    }

    const view = render(() => <Harness />)
    const feature = columns!
    core!.on<GridColumnsChange>(GRID_COLUMNS_CHANGE_EVENT, (event) => events.push(event))
    expect(core!.features.filter((name) => name === 'columns')).toHaveLength(1)
    expect(feature.model).toBe(core!.invoke<GridColumnsModel>('getColumnsModel'))

    feature.model.syncVisibility({ hidden: false })
    feature.model.syncWidths({ name: 120 })
    expect(onVisibilityChange).not.toHaveBeenCalled()
    expect(onWidthsChange).not.toHaveBeenCalled()
    expect(events).toEqual([])

    feature.setVisibility({ hidden: true })
    feature.setWidths({ name: 140 })
    expect(onVisibilityChange).toHaveBeenCalledWith({ hidden: true })
    expect(onWidthsChange).toHaveBeenCalledWith({ name: 140 })

    feature.resetWidths()
    expect(onWidthsChange).toHaveBeenLastCalledWith({})
    view.unmount()
    expect(core!.status).toBe('destroyed')
  })
})
