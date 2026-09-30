import { fireEvent, render } from '@testing-library/svelte'
import { tick } from 'svelte'
import { describe, expect, it, vi } from 'vitest'
import { get, type Readable } from 'svelte/store'
import {
  type GridFilterValues,
  type GridFilteringModel,
  type GridSortingModel,
  type SelectionModel,
  type SortState,
} from '@iris-ui-kit/core/grid'
import GridControlledBatchHandoffHarness from './GridControlledBatchHandoffHarness.svelte'
import GridSelectionControlledHarness from './GridSelectionControlledHarness.svelte'
import { useGridSelection } from './useGrid'

describe('Svelte Grid selection handoff', () => {
  it('retains the first controlled snapshot across a silent selection and sort handoff detour', async () => {
    let selectionModel!: SelectionModel<string>
    let sortingModel!: GridSortingModel
    let selection!: Readable<string[]>
    let sort!: Readable<SortState | null>
    const onChange = vi.fn()
    const onSortChange = vi.fn()
    const selectionEvents = vi.fn()
    const sortingEvents = vi.fn()
    const view = render(GridSelectionControlledHarness, {
      props: {
        value: ['a'],
        sort: { key: 'name', direction: 'asc' },
        onChange,
        onSortChange,
        onSelectionEvent: selectionEvents,
        onSortingEvent: sortingEvents,
        onModel: (value) => (selectionModel = value),
        onSortingModel: (value) => (sortingModel = value),
        onSelection: (value) => (selection = value),
        onSort: (value) => (sort = value),
      },
    })
    await tick()

    const initialCounts = {
      onChange: onChange.mock.calls.length,
      onSortChange: onSortChange.mock.calls.length,
      selectionEvents: selectionEvents.mock.calls.length,
      sortingEvents: sortingEvents.mock.calls.length,
    }
    const expectSilent = (): void => {
      expect(onChange).toHaveBeenCalledTimes(initialCounts.onChange)
      expect(onSortChange).toHaveBeenCalledTimes(initialCounts.onSortChange)
      expect(selectionEvents).toHaveBeenCalledTimes(initialCounts.selectionEvents)
      expect(sortingEvents).toHaveBeenCalledTimes(initialCounts.sortingEvents)
    }
    expect(get(selection)).toEqual(['a'])
    expect(selectionModel.get()).toEqual(['a'])
    expect(get(sort)).toEqual({ key: 'name', direction: 'asc' })
    expect(sortingModel.get().sort).toEqual({ key: 'name', direction: 'asc' })

    await view.rerender({ value: undefined, sort: undefined })
    await tick()
    expect(get(selection)).toEqual(['a'])
    expect(selectionModel.get()).toEqual(['a'])
    expect(get(sort)).toEqual({ key: 'name', direction: 'asc' })
    expect(sortingModel.get().sort).toEqual({ key: 'name', direction: 'asc' })
    expectSilent()

    await view.rerender({
      value: ['b'],
      sort: { key: 'age', direction: 'desc' },
    })
    await tick()
    expect(get(selection)).toEqual(['b'])
    expect(selectionModel.get()).toEqual(['b'])
    expect(get(sort)).toEqual({ key: 'age', direction: 'desc' })
    expect(sortingModel.get().sort).toEqual({ key: 'age', direction: 'desc' })
    expectSilent()

    await view.rerender({ value: undefined, sort: undefined })
    await tick()
    expect(get(selection)).toEqual(['a'])
    expect(selectionModel.get()).toEqual(['a'])
    expect(get(sort)).toEqual({ key: 'name', direction: 'asc' })
    expect(sortingModel.get().sort).toEqual({ key: 'name', direction: 'asc' })
    expectSilent()
    view.unmount()
  })

  it('preserves a batched selection update across controlled handoff release', async () => {
    let bridge!: {
      selection: { model: SelectionModel<string>; value: Readable<string[]> }
    }
    const onChange = vi.fn()
    const onSelectionEvent = vi.fn()
    const view = render(GridControlledBatchHandoffHarness, {
      props: {
        onReady: (value) => (bridge = value),
        onSelectionChange: onChange,
        onSelectionEvent,
      },
    })
    await tick()

    expect(get(bridge.selection.value)).toEqual(['a'])
    expect(bridge.selection.model.get()).toEqual(['a'])

    await fireEvent.click(view.getByTestId('handoff-selection'))
    await tick()

    expect(get(bridge.selection.value)).toEqual(['c'])
    expect(bridge.selection.model.get()).toEqual(['c'])
    expect(view.getByTestId('selection').textContent).toBe('["c"]')
    const countsBeforeRelease = {
      onChange: onChange.mock.calls.length,
      selectionEvent: onSelectionEvent.mock.calls.length,
    }
    expect(onChange).toHaveBeenCalledWith(['b'])
    expect(onSelectionEvent).toHaveBeenCalledWith({ selectedKeys: ['b'] })

    await fireEvent.click(view.getByTestId('release-selection'))
    await tick()

    expect(get(bridge.selection.value)).toEqual(['b'])
    expect(bridge.selection.model.get()).toEqual(['b'])
    expect(view.getByTestId('selection').textContent).toBe('["b"]')
    expect({
      onChange: onChange.mock.calls.length,
      selectionEvent: onSelectionEvent.mock.calls.length,
    }).toEqual(countsBeforeRelease)
    view.unmount()
  })

  it('preserves a batched sort update across controlled handoff release', async () => {
    let bridge!: {
      sorting: { model: GridSortingModel; value: Readable<SortState | null> }
    }
    const onSortChange = vi.fn()
    const onSortingEvent = vi.fn()
    const view = render(GridControlledBatchHandoffHarness, {
      props: {
        onReady: (value) => (bridge = value),
        onSortChange,
        onSortingEvent,
      },
    })
    await tick()

    expect(get(bridge.sorting.value)).toEqual({ key: 'name', direction: 'asc' })
    expect(bridge.sorting.model.get().sort).toEqual({ key: 'name', direction: 'asc' })

    await fireEvent.click(view.getByTestId('handoff-sort'))
    await tick()

    expect(get(bridge.sorting.value)).toEqual({ key: 'status', direction: 'asc' })
    expect(bridge.sorting.model.get().sort).toEqual({ key: 'status', direction: 'asc' })
    expect(view.getByTestId('sort').textContent).toBe('{"key":"status","direction":"asc"}')
    const countsBeforeRelease = {
      onSortChange: onSortChange.mock.calls.length,
      sortingEvent: onSortingEvent.mock.calls.length,
    }
    expect(onSortChange).toHaveBeenCalledWith({ key: 'age', direction: 'desc' })
    expect(onSortingEvent).toHaveBeenCalledWith({
      mode: 'single',
      sort: { key: 'age', direction: 'desc' },
    })

    await fireEvent.click(view.getByTestId('release-sort'))
    await tick()

    expect(get(bridge.sorting.value)).toEqual({ key: 'age', direction: 'desc' })
    expect(bridge.sorting.model.get().sort).toEqual({ key: 'age', direction: 'desc' })
    expect(view.getByTestId('sort').textContent).toBe('{"key":"age","direction":"desc"}')
    expect({
      onSortChange: onSortChange.mock.calls.length,
      sortingEvent: onSortingEvent.mock.calls.length,
    }).toEqual(countsBeforeRelease)
    view.unmount()
  })

  it('keeps a rejected controlled toggle out of the rendered selection', async () => {
    let selection!: Readable<string[]>
    const onChange = vi.fn()
    const view = render(GridSelectionControlledHarness, {
      props: {
        value: ['a'],
        onChange,
        onSelection: (value) => (selection = value),
      },
    })
    await tick()
    onChange.mockReset()

    await fireEvent.click(view.getByTestId('toggle-b'))
    await tick()

    expect(onChange).toHaveBeenCalledWith(['a', 'b'])
    expect(view.getByTestId('selection').textContent).toBe('["a"]')
    expect(get(selection)).toEqual(['a'])
  })

  it('rebases rejected controlled selection before synchronous toggles', async () => {
    let selection!: ReturnType<typeof useGridSelection>
    const onChange = vi.fn()
    const view = render(GridSelectionControlledHarness, {
      props: {
        mode: 'multiple',
        value: ['a'],
        onChange,
        onSelectionResult: (value) => (selection = value),
      },
    })
    await tick()

    expect(selection).toBeDefined()
    expect(get(selection.selection)).toEqual(['a'])
    expect(view.getByTestId('selection').textContent).toBe('["a"]')
    expect(onChange).not.toHaveBeenCalled()

    selection.rebase()
    expect(onChange).not.toHaveBeenCalled()
    selection.model.toggle('b')
    selection.rebase()
    expect(onChange).toHaveBeenCalledTimes(1)
    selection.model.toggle('c')

    expect(onChange.mock.calls.map(([keys]) => keys)).toEqual([
      ['a', 'b'],
      ['a', 'c'],
    ])
    expect(onChange.mock.calls.map(([keys]) => keys)).not.toContainEqual(['a', 'b', 'c'])
    expect(get(selection.selection)).toEqual(['a'])
    expect(view.getByTestId('selection').textContent).toBe('["a"]')
    view.unmount()
  })

  it('repairs a mutated controlled selection snapshot after a rejected toggle', async () => {
    const controlledValue = ['a']
    let selection!: Readable<string[]>
    const onChange = vi.fn()
    const view = render(GridSelectionControlledHarness, {
      props: {
        value: controlledValue,
        onChange,
        onSelection: (value) => (selection = value),
      },
    })
    await tick()

    get(selection).push('externally-mutated')
    expect(controlledValue).toEqual(['a'])
    onChange.mockReset()

    await fireEvent.click(view.getByTestId('toggle-b'))
    await tick()

    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange).toHaveBeenCalledWith(['a', 'b'])
    expect(get(selection)).toEqual(['a'])

    await view.rerender({ value: ['a'] })
    await tick()
    expect(view.getByTestId('selection').textContent).toBe('["a"]')
    expect(onChange).toHaveBeenCalledTimes(1)
    view.unmount()
  })

  it('repairs a mutated controlled filters snapshot after a rejected proposal', async () => {
    const controlledFilters = { status: 'active' }
    let filteringModel!: GridFilteringModel
    let filters!: Readable<Record<string, string>>
    const onFiltersChange = vi.fn()
    const view = render(GridSelectionControlledHarness, {
      props: {
        filters: controlledFilters,
        onFiltersChange,
        onFilteringModel: (value) => (filteringModel = value),
        onFilters: (value) => (filters = value),
      },
    })
    await tick()

    get(filters).status = 'externally-mutated'
    expect(controlledFilters).toEqual({ status: 'active' })
    onFiltersChange.mockReset()

    filteringModel.setFilters({ status: 'paused' })
    await tick()

    expect(onFiltersChange).toHaveBeenCalledTimes(1)
    expect(onFiltersChange).toHaveBeenCalledWith({ status: 'paused' })
    expect(get(filters)).toEqual({ status: 'active' })

    await view.rerender({ filters: { status: 'active' } })
    await tick()
    expect(view.getByTestId('filters').textContent).toBe('{"status":"active"}')
    expect(onFiltersChange).toHaveBeenCalledTimes(1)
    view.unmount()
  })

  it('repairs a mutated uncontrolled sort snapshot after a sibling multi-sort update', async () => {
    const acceptedSort: SortState = { key: 'name', direction: 'asc' }
    const requestedMultiSort: SortState[] = [{ key: 'age', direction: 'desc' }]
    let sortingModel!: GridSortingModel
    let sort!: Readable<SortState | null>
    const onSortChange = vi.fn()
    const onMultiSortChange = vi.fn()
    const sortingEvent = vi.fn()
    const view = render(GridSelectionControlledHarness, {
      props: {
        defaultSort: acceptedSort,
        onSortChange,
        onMultiSortChange,
        onSortingModel: (value) => (sortingModel = value),
        onSort: (value) => (sort = value),
        onSortingEvent: sortingEvent,
      },
    })
    await tick()

    const mutated = get(sort)
    mutated!.key = 'externally-mutated'
    sortingModel.setMultiSort(requestedMultiSort)
    await tick()

    const repaired = get(sort)
    expect(repaired).toEqual(acceptedSort)
    expect(repaired).not.toBe(mutated)
    expect(repaired).not.toBe(acceptedSort)
    expect(sortingModel.get().sort).toEqual(acceptedSort)
    expect(sortingModel.get().multiSort).toEqual(requestedMultiSort)
    expect(onSortChange).not.toHaveBeenCalled()
    expect(onMultiSortChange).toHaveBeenCalledTimes(1)
    expect(onMultiSortChange).toHaveBeenCalledWith(requestedMultiSort)
    expect(sortingEvent).toHaveBeenCalledTimes(1)
    expect(sortingEvent).toHaveBeenCalledWith({ mode: 'multiple', sorts: requestedMultiSort })
    view.unmount()
  })

  it('repairs a mutated uncontrolled filters snapshot after a sibling filter-values update', async () => {
    const acceptedFilters = { status: 'active' }
    const requestedFilterValues = { status: ['paused'] }
    let filteringModel!: GridFilteringModel
    let filters!: Readable<Record<string, string>>
    const onFiltersChange = vi.fn()
    const onFilterValuesChange = vi.fn()
    const filteringEvent = vi.fn()
    const view = render(GridSelectionControlledHarness, {
      props: {
        defaultFilters: acceptedFilters,
        onFiltersChange,
        onFilterValuesChange,
        onFilteringModel: (value) => (filteringModel = value),
        onFilters: (value) => (filters = value),
        onFilteringEvent: filteringEvent,
      },
    })
    await tick()

    const mutated = get(filters)
    mutated.status = 'externally-mutated'
    filteringModel.setFilterValues(requestedFilterValues)
    await tick()

    const repaired = get(filters)
    expect(repaired).toEqual(acceptedFilters)
    expect(repaired).not.toBe(mutated)
    expect(repaired).not.toBe(acceptedFilters)
    expect(filteringModel.get().filters).toEqual(acceptedFilters)
    expect(filteringModel.get().filterValues).toEqual(requestedFilterValues)
    expect(onFiltersChange).not.toHaveBeenCalled()
    expect(onFilterValuesChange).toHaveBeenCalledTimes(1)
    expect(onFilterValuesChange).toHaveBeenCalledWith(requestedFilterValues)
    expect(filteringEvent).toHaveBeenCalledTimes(1)
    expect(filteringEvent).toHaveBeenCalledWith({
      channel: 'values',
      filterValues: requestedFilterValues,
    })
    expect(
      filteringEvent.mock.calls.some(
        ([payload]) => (payload as { channel?: string }).channel === 'filters',
      ),
    ).toBe(false)
    view.unmount()
  })

  it('repairs mutated controlled snapshots on an equivalent prop refresh', async () => {
    const controlledValue = ['a']
    const controlledSort = { key: 'name', direction: 'asc' as const }
    const controlledMultiSort = [{ key: 'name', direction: 'asc' as const }]
    const controlledFilters = { name: 'old' }
    const controlledFilterValues = { status: ['active'] }
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
        value: controlledValue,
        sort: controlledSort,
        multiSortState: controlledMultiSort,
        filters: controlledFilters,
        filterValues: controlledFilterValues,
        onChange,
        onSortChange,
        onMultiSortChange,
        onFiltersChange,
        onFilterValuesChange,
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

    const mutatedSelection = get(selection)
    const mutatedSort = get(sort)
    const mutatedMultiSort = get(multiSort)
    const mutatedFilters = get(filters)
    const mutatedFilterValues = get(filterValues)
    mutatedSelection.push('externally-mutated')
    mutatedSort!.key = 'externally-mutated'
    mutatedMultiSort[0]!.direction = 'desc'
    mutatedMultiSort.push({ key: 'externally-mutated', direction: 'asc' })
    mutatedFilters.name = 'externally-mutated'
    mutatedFilterValues.status!.push('externally-mutated')

    expect(controlledValue).toEqual(['a'])
    expect(controlledSort).toEqual({ key: 'name', direction: 'asc' })
    expect(controlledMultiSort).toEqual([{ key: 'name', direction: 'asc' }])
    expect(controlledFilters).toEqual({ name: 'old' })
    expect(controlledFilterValues).toEqual({ status: ['active'] })
    vi.clearAllMocks()

    await view.rerender({
      value: ['a'],
      sort: { key: 'name', direction: 'asc' },
      multiSortState: [{ key: 'name', direction: 'asc' }],
      filters: { name: 'old' },
      filterValues: { status: ['active'] },
    })
    await tick()

    const repairedSelection = get(selection)
    const repairedSort = get(sort)
    const repairedMultiSort = get(multiSort)
    const repairedFilters = get(filters)
    const repairedFilterValues = get(filterValues)
    expect(repairedSelection).toEqual(['a'])
    expect(repairedSelection).not.toBe(mutatedSelection)
    expect(repairedSelection).not.toBe(controlledValue)
    expect(repairedSort).toEqual({ key: 'name', direction: 'asc' })
    expect(repairedSort).not.toBe(mutatedSort)
    expect(repairedSort).not.toBe(controlledSort)
    expect(repairedMultiSort).toEqual([{ key: 'name', direction: 'asc' }])
    expect(repairedMultiSort).not.toBe(mutatedMultiSort)
    expect(repairedMultiSort[0]).not.toBe(mutatedMultiSort[0])
    expect(repairedMultiSort[0]).not.toBe(controlledMultiSort[0])
    expect(repairedFilters).toEqual({ name: 'old' })
    expect(repairedFilters).not.toBe(mutatedFilters)
    expect(repairedFilters).not.toBe(controlledFilters)
    expect(repairedFilterValues).toEqual({ status: ['active'] })
    expect(repairedFilterValues).not.toBe(mutatedFilterValues)
    expect(repairedFilterValues).not.toBe(controlledFilterValues)
    expect(repairedFilterValues.status).not.toBe(mutatedFilterValues.status)
    expect(repairedFilterValues.status).not.toBe(controlledFilterValues.status)
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
})
