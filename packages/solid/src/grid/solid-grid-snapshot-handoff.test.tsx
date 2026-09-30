import { cleanup, render, renderHook, waitFor } from '@solidjs/testing-library'
import { createSignal } from 'solid-js'
import type { Store } from '@iris-ui-kit/core'
import { describe, expect, it, afterEach, vi } from 'vitest'
import {
  GRID_COLUMNS_CHANGE_EVENT,
  GRID_FILTERING_CHANGE_EVENT,
  GRID_SELECTION_CHANGE_EVENT,
  GRID_SORTING_CHANGE_EVENT,
  GridCore,
  GridFilterValues,
  SortState,
} from '@iris-ui-kit/core/grid'
import {
  useGridColumns,
  useGridCore,
  useGridFiltering,
  useGridRows,
  useGridSelection,
  useGridSorting,
  useGridVirtual,
} from './index'

afterEach(cleanup)

describe('solid grid snapshot handoff', () => {
  it('preserves a batched uncontrolled selection across controlled handoff release', async () => {
    const onChange = vi.fn()
    const selectionEvent = vi.fn()
    let setControlled!: (value: string[] | undefined) => void
    let core!: GridCore
    let selection!: ReturnType<typeof useGridSelection>

    const Harness = (props: {
      value?: string[]
      defaultValue: string[]
      onChange: (keys: string[]) => void
    }) => {
      core = useGridCore()
      selection = useGridSelection(core, props)
      return <output data-testid="selection">{JSON.stringify(selection.selection())}</output>
    }
    const Parent = () => {
      const [value, updateValue] = createSignal<string[] | undefined>()
      setControlled = updateValue
      return <Harness value={value()} defaultValue={['a']} onChange={onChange} />
    }

    const view = render(() => <Parent />)
    await waitFor(() => expect(selection.selection()).toEqual(['a']))
    core.on(GRID_SELECTION_CHANGE_EVENT, selectionEvent)
    const store = selection.model.store as unknown as Store<string[]>

    store.batch(() => {
      selection.model.set(['b'])
      setControlled(['c'])
    })

    await waitFor(() => {
      expect(selection.selection()).toEqual(['c'])
      expect(selection.model.get()).toEqual(['c'])
      expect(selection.model.store.getState()).toEqual(['c'])
      expect(view.getByTestId('selection').textContent).toBe('["c"]')
    })
    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange).toHaveBeenCalledWith(['b'])
    expect(selectionEvent).toHaveBeenCalledTimes(1)
    expect(selectionEvent).toHaveBeenCalledWith({ selectedKeys: ['b'] })
    const countsBeforeRelease = {
      onChange: onChange.mock.calls.length,
      selectionEvent: selectionEvent.mock.calls.length,
    }

    setControlled(undefined)
    await waitFor(() => {
      expect(selection.selection()).toEqual(['b'])
      expect(selection.model.get()).toEqual(['b'])
      expect(selection.model.store.getState()).toEqual(['b'])
      expect(view.getByTestId('selection').textContent).toBe('["b"]')
    })
    expect(onChange).toHaveBeenCalledTimes(countsBeforeRelease.onChange)
    expect(selectionEvent).toHaveBeenCalledTimes(countsBeforeRelease.selectionEvent)
    view.unmount()
  })

  it('preserves batched uncontrolled sorting, filtering, and column snapshots', async () => {
    const sortB: SortState = { key: 'age', direction: 'desc' }
    const sortC: SortState = { key: 'status', direction: 'asc' }
    const multiSortB: SortState[] = [{ key: 'age', direction: 'desc' }]
    const multiSortC: SortState[] = [{ key: 'status', direction: 'asc' }]
    const filtersB = { age: '30' }
    const filtersC = { status: 'active' }
    const filterValuesB: GridFilterValues = { age: ['30'] }
    const filterValuesC: GridFilterValues = { status: ['active'] }
    const visibilityB = { age: true }
    const visibilityC = { age: false }
    const orderB = ['age', 'name']
    const orderC = ['name']
    const widthsB = { name: 116 }
    const widthsC = { name: 310 }
    const pinnedB: Record<string, 'left' | 'right' | null> = { name: null }
    const pinnedC: Record<string, 'left' | 'right' | null> = { name: 'right' }
    const onSortChange = vi.fn()
    const onMultiSortChange = vi.fn()
    const onFiltersChange = vi.fn()
    const onFilterValuesChange = vi.fn()
    const onVisibilityChange = vi.fn()
    const onOrderChange = vi.fn()
    const onWidthsChange = vi.fn()
    const onPinnedChange = vi.fn()
    const sortingEvents = vi.fn()
    const filteringEvents = vi.fn()
    const columnEvents = vi.fn()
    let setSort!: (value: SortState | undefined) => void
    let setMultiSort!: (value: SortState[] | undefined) => void
    let setFilters!: (value: Record<string, string> | undefined) => void
    let setFilterValues!: (value: GridFilterValues | undefined) => void
    let setVisibility!: (value: Record<string, boolean> | undefined) => void
    let setOrder!: (value: string[] | undefined) => void
    let setWidths!: (value: Record<string, number> | undefined) => void
    let setPinned!: (value: Record<string, 'left' | 'right' | null> | undefined) => void
    let core!: GridCore
    let sorting!: ReturnType<typeof useGridSorting>
    let filtering!: ReturnType<typeof useGridFiltering>
    let columns!: ReturnType<typeof useGridColumns>

    type Props = {
      sort?: SortState
      multiSortState?: SortState[]
      filters?: Record<string, string>
      filterValues?: GridFilterValues
      visibility?: Record<string, boolean>
      order?: string[]
      widths?: Record<string, number>
      pinned?: Record<string, 'left' | 'right' | null>
      mode: 'multiple'
      defaultSort: SortState
      defaultMultiSort: SortState[]
      defaultFilters: Record<string, string>
      defaultFilterValues: GridFilterValues
      defaultVisibility: Record<string, boolean>
      defaultOrder: string[]
      defaultWidths: Record<string, number>
      defaultPinned: Record<string, 'left' | 'right' | null>
      onSortChange: (sort: SortState | null) => void
      onMultiSortChange: (sorts: SortState[]) => void
      onFiltersChange: (filters: Record<string, string>) => void
      onFilterValuesChange: (values: GridFilterValues) => void
      onVisibilityChange: (value: Record<string, boolean>) => void
      onOrderChange: (value: string[] | undefined) => void
      onWidthsChange: (value: Record<string, number>) => void
      onPinnedChange: (key: string, side: 'left' | 'right' | null) => void
    }
    const Harness = (props: Props) => {
      core = useGridCore()
      sorting = useGridSorting(core, props)
      filtering = useGridFiltering(core, props)
      columns = useGridColumns(core, props)
      return <div />
    }
    const Parent = () => {
      const [sort, updateSort] = createSignal<SortState | undefined>()
      const [multiSortState, updateMultiSort] = createSignal<SortState[] | undefined>()
      const [filters, updateFilters] = createSignal<Record<string, string> | undefined>()
      const [filterValues, updateFilterValues] = createSignal<GridFilterValues | undefined>()
      const [visibility, updateVisibility] = createSignal<Record<string, boolean> | undefined>()
      const [order, updateOrder] = createSignal<string[] | undefined>()
      const [widths, updateWidths] = createSignal<Record<string, number> | undefined>()
      const [pinned, updatePinned] = createSignal<
        Record<string, 'left' | 'right' | null> | undefined
      >()
      setSort = updateSort
      setMultiSort = updateMultiSort
      setFilters = updateFilters
      setFilterValues = updateFilterValues
      setVisibility = updateVisibility
      setOrder = updateOrder
      setWidths = updateWidths
      setPinned = updatePinned
      return (
        <Harness
          sort={sort()}
          multiSortState={multiSortState()}
          filters={filters()}
          filterValues={filterValues()}
          visibility={visibility()}
          order={order()}
          widths={widths()}
          pinned={pinned()}
          mode="multiple"
          defaultSort={{ key: 'name', direction: 'asc' }}
          defaultMultiSort={[{ key: 'name', direction: 'asc' }]}
          defaultFilters={{ name: 'Ada' }}
          defaultFilterValues={{ name: ['Ada'] }}
          defaultVisibility={{ age: false }}
          defaultOrder={['name']}
          defaultWidths={{ name: 100 }}
          defaultPinned={{ name: 'left' }}
          onSortChange={onSortChange}
          onMultiSortChange={onMultiSortChange}
          onFiltersChange={onFiltersChange}
          onFilterValuesChange={onFilterValuesChange}
          onVisibilityChange={onVisibilityChange}
          onOrderChange={onOrderChange}
          onWidthsChange={onWidthsChange}
          onPinnedChange={onPinnedChange}
        />
      )
    }

    const view = render(() => <Parent />)
    core.on(GRID_SORTING_CHANGE_EVENT, sortingEvents)
    core.on(GRID_FILTERING_CHANGE_EVENT, filteringEvents)
    core.on(GRID_COLUMNS_CHANGE_EVENT, columnEvents)

    sorting.model.store.batch(() => {
      sorting.model.setSort(sortB)
      sorting.model.setMultiSort(multiSortB)
      setSort(sortC)
      setMultiSort(multiSortC)
    })
    await waitFor(() => {
      expect(sorting.sort()).toEqual(sortC)
      expect(sorting.multiSort()).toEqual(multiSortC)
      expect(sorting.model.get()).toEqual({ sort: sortC, multiSort: multiSortC })
    })
    const sortingCounts = {
      sort: onSortChange.mock.calls.length,
      multiSort: onMultiSortChange.mock.calls.length,
      events: sortingEvents.mock.calls.length,
    }

    filtering.model.store.batch(() => {
      filtering.model.setFilters(filtersB)
      filtering.model.setFilterValues(filterValuesB)
      setFilters(filtersC)
      setFilterValues(filterValuesC)
    })
    await waitFor(() => {
      expect(filtering.filters()).toEqual(filtersC)
      expect(filtering.filterValues()).toEqual(filterValuesC)
      expect(filtering.model.get()).toEqual({ filters: filtersC, filterValues: filterValuesC })
    })
    const filteringCounts = {
      filters: onFiltersChange.mock.calls.length,
      filterValues: onFilterValuesChange.mock.calls.length,
      events: filteringEvents.mock.calls.length,
    }

    columns.model.store.batch(() => {
      columns.model.setVisibility(visibilityB)
      columns.model.setOrder(orderB)
      columns.model.setWidths(widthsB)
      columns.model.setPinned('name', pinnedB.name)
      setVisibility(visibilityC)
      setOrder(orderC)
      setWidths(widthsC)
      setPinned(pinnedC)
    })
    await waitFor(() => {
      expect(columns.state()).toMatchObject({
        visibility: visibilityC,
        order: orderC,
        widths: widthsC,
        pinned: pinnedC,
      })
      expect(columns.model.get()).toMatchObject({
        visibility: visibilityC,
        order: orderC,
        widths: widthsC,
        pinned: pinnedC,
      })
    })
    const columnCounts = {
      visibility: onVisibilityChange.mock.calls.length,
      order: onOrderChange.mock.calls.length,
      widths: onWidthsChange.mock.calls.length,
      pinned: onPinnedChange.mock.calls.length,
      events: columnEvents.mock.calls.length,
    }

    setSort(undefined)
    setMultiSort(undefined)
    setFilters(undefined)
    setFilterValues(undefined)
    setVisibility(undefined)
    setOrder(undefined)
    setWidths(undefined)
    setPinned(undefined)
    await waitFor(() => {
      expect(sorting.sort()).toEqual(sortB)
      expect(sorting.multiSort()).toEqual(multiSortB)
      expect(filtering.filters()).toEqual(filtersB)
      expect(filtering.filterValues()).toEqual(filterValuesB)
      expect(columns.state()).toMatchObject({
        visibility: visibilityB,
        order: orderB,
        widths: widthsB,
        pinned: pinnedB,
      })
    })
    expect(onSortChange).toHaveBeenCalledTimes(sortingCounts.sort)
    expect(onMultiSortChange).toHaveBeenCalledTimes(sortingCounts.multiSort)
    expect(sortingEvents).toHaveBeenCalledTimes(sortingCounts.events)
    expect(onFiltersChange).toHaveBeenCalledTimes(filteringCounts.filters)
    expect(onFilterValuesChange).toHaveBeenCalledTimes(filteringCounts.filterValues)
    expect(filteringEvents).toHaveBeenCalledTimes(filteringCounts.events)
    expect(onVisibilityChange).toHaveBeenCalledTimes(columnCounts.visibility)
    expect(onOrderChange).toHaveBeenCalledTimes(columnCounts.order)
    expect(onWidthsChange).toHaveBeenCalledTimes(columnCounts.widths)
    expect(onPinnedChange).toHaveBeenCalledTimes(columnCounts.pinned)
    expect(columnEvents).toHaveBeenCalledTimes(columnCounts.events)
    view.unmount()
  })

  it('reflects a plain controlled visibility/widths prop change synchronously', () => {
    let setVisibility!: (value: Record<string, boolean> | undefined) => void
    let setWidths!: (value: Record<string, number> | undefined) => void
    let columns!: ReturnType<typeof useGridColumns>

    type Props = {
      visibility?: Record<string, boolean>
      widths?: Record<string, number>
      defaultVisibility: Record<string, boolean>
      defaultWidths: Record<string, number>
    }
    const Harness = (props: Props) => {
      const core = useGridCore()
      columns = useGridColumns(core, props)
      return (
        <>
          <output data-testid="visibility">{String(columns.state().visibility.age)}</output>
          <output data-testid="widths">{String(columns.state().widths.name)}</output>
        </>
      )
    }
    const Parent = () => {
      const [visibility, updateVisibility] = createSignal<Record<string, boolean> | undefined>({
        age: false,
      })
      const [widths, updateWidths] = createSignal<Record<string, number> | undefined>({ name: 100 })
      setVisibility = updateVisibility
      setWidths = updateWidths
      return (
        <Harness
          visibility={visibility()}
          widths={widths()}
          defaultVisibility={{ age: false }}
          defaultWidths={{ name: 100 }}
        />
      )
    }

    const view = render(() => <Parent />)
    expect(view.getByTestId('visibility').textContent).toBe('false')
    expect(view.getByTestId('widths').textContent).toBe('100')

    // A plain (non-batched) controlled prop change must land in the SAME
    // synchronous turn — no `waitFor`, unlike the batched handoff path above.
    setVisibility({ age: true })
    expect(view.getByTestId('visibility').textContent).toBe('true')
    setWidths({ name: 310 })
    expect(view.getByTestId('widths').textContent).toBe('310')

    // Dropping the controlled channel falls back to the uncontrolled snapshot.
    setVisibility(undefined)
    expect(view.getByTestId('visibility').textContent).toBe('false')
    view.unmount()
  })

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
})
