import { fireEvent, render } from '@testing-library/svelte'
import { tick } from 'svelte'
import { describe, expect, it, vi } from 'vitest'
import { get, type Readable } from 'svelte/store'
import {
  GRID_COLUMNS_CHANGE_EVENT,
  type GridColumnsChange,
  type GridCore,
  type GridFilterValues,
  type GridFilteringModel,
  type GridSortingModel,
  type GridVirtualModel,
  type VirtualizerState,
  type SelectionModel,
  type SortState,
} from '@iris-ui-kit/core/grid'
import GridBridgeHarness from './GridBridgeHarness.svelte'
import GridColumnsBridgeHarness from './GridColumnsBridgeHarness.svelte'
import GridSelectionControlledHarness from './GridSelectionControlledHarness.svelte'
import GridVirtualBridgeHarness from './GridVirtualBridgeHarness.svelte'
import { useGridColumns, useGridSelection } from './useGrid'

describe('Svelte Grid Core bridge', () => {
  it('installs columns on the same core and keeps inbound sync silent', async () => {
    let core: GridCore<{ id: string }> | undefined
    const onVisibilityChange = vi.fn()
    const onWidthsChange = vi.fn()
    const view = render(GridColumnsBridgeHarness, {
      props: {
        onCore: (value) => (core = value),
        onVisibilityChange,
        onWidthsChange,
      },
    })

    expect(core).toBeDefined()
    expect(core!.features.filter((name) => name === 'columns')).toHaveLength(1)
    expect(
      view.container.querySelector('[data-model-identity]')?.getAttribute('data-model-identity'),
    ).toBe('true')

    await fireEvent.click(view.getByTestId('sync-visibility'))
    await fireEvent.click(view.getByTestId('sync-widths'))
    expect(onVisibilityChange).not.toHaveBeenCalled()
    expect(onWidthsChange).not.toHaveBeenCalled()

    await fireEvent.click(view.getByTestId('set-widths'))
    await fireEvent.click(view.getByTestId('set-visibility'))
    expect(onWidthsChange).toHaveBeenCalledWith({ name: 140 })
    expect(onVisibilityChange).toHaveBeenCalledWith({ hidden: true })

    await fireEvent.click(view.getByTestId('reset-widths'))
    expect(onWidthsChange).toHaveBeenLastCalledWith({})
    view.unmount()
    expect(core!.status).toBe('destroyed')
  })

  it('restores the uncontrolled visibility snapshot across rejected control handoff', async () => {
    const view = render(GridColumnsBridgeHarness, {
      props: { visibility: { hidden: false }, defaultVisibility: { hidden: false } },
    })
    const readVisibility = (): boolean | undefined =>
      JSON.parse(view.getByTestId('column-state').textContent ?? '{}').visibility?.hidden

    expect(readVisibility()).toBe(false)
    await fireEvent.click(view.getByTestId('toggle-visibility'))
    expect(readVisibility()).toBe(false)

    await view.rerender({ visibility: undefined })
    expect(readVisibility()).toBe(false)

    await view.rerender({ visibility: { hidden: true } })
    expect(readVisibility()).toBe(true)
    await view.rerender({ visibility: undefined })
    expect(readVisibility()).toBe(false)
    view.unmount()
  })

  it('isolates all column snapshots and restores each uncontrolled channel after handoff', async () => {
    let columns!: ReturnType<typeof useGridColumns>
    const controlled = {
      visibility: { hidden: false },
      order: ['name'],
      widths: { name: 310 },
      pinned: { name: 'right' as const },
    }
    const view = render(GridColumnsBridgeHarness, {
      props: {
        defaultVisibility: { hidden: false },
        defaultOrder: ['name', 'age'],
        defaultWidths: { name: 100 },
        defaultPinned: { name: 'left' },
        onColumns: (value) => (columns = value),
      },
    })

    await fireEvent.click(view.getByTestId('edit-columns'))
    expect(columns.model.get()).toMatchObject({
      visibility: { hidden: true },
      order: ['age', 'name'],
      widths: { name: 116 },
      pinned: { name: null },
    })

    await view.rerender(controlled)
    expect(columns.model.get()).toMatchObject(controlled)
    const snapshot = get(columns.state)
    snapshot.visibility.hidden = true
    snapshot.order.push('mutated')
    snapshot.widths.name = 999
    snapshot.pinned.name = 'left'
    expect(columns.model.get()).toMatchObject(controlled)

    controlled.visibility.hidden = true
    controlled.order.push('mutated-input')
    controlled.widths.name = 998
    controlled.pinned.name = 'left'
    expect(columns.model.get()).toMatchObject({
      visibility: { hidden: false },
      order: ['name'],
      widths: { name: 310 },
      pinned: { name: 'right' },
    })

    await view.rerender({
      visibility: undefined,
      order: undefined,
      widths: undefined,
      pinned: undefined,
    })
    expect(columns.model.get()).toMatchObject({
      visibility: { hidden: true },
      order: ['age', 'name'],
      widths: { name: 116 },
      pinned: { name: null },
    })
    view.unmount()
  })

  it('rebases controlled column proposals without losing uncontrolled snapshots', async () => {
    let core!: GridCore<{ id: string }>
    let columns!: ReturnType<typeof useGridColumns>
    const onOrderChange = vi.fn()
    const onWidthsChange = vi.fn()
    const onPinnedChange = vi.fn()
    const events: GridColumnsChange[] = []
    const view = render(GridColumnsBridgeHarness, {
      props: {
        defaultOrder: ['name', 'age'],
        defaultWidths: { name: 100, age: 200 },
        defaultPinned: { name: 'left', age: 'right' },
        onCore: (value) => (core = value),
        onColumns: (value) => (columns = value),
        onOrderChange,
        onWidthsChange,
        onPinnedChange,
      },
    })
    await tick()

    core.on<GridColumnsChange>(GRID_COLUMNS_CHANGE_EVENT, (event) => events.push(event))
    columns.setOrder(['age', 'name'])
    columns.setWidths({ name: 116, age: 216 })
    columns.setPinned('name', null)
    await tick()
    expect(columns.model.get()).toEqual({
      visibility: {},
      order: ['age', 'name'],
      widths: { name: 116, age: 216 },
      pinned: { name: null, age: 'right' },
    })

    onOrderChange.mockClear()
    onWidthsChange.mockClear()
    onPinnedChange.mockClear()
    events.length = 0

    const controlledOrder = ['name']
    const controlledWidths = { name: 310, age: 260 }
    const controlledPinned: Record<string, 'left' | 'right' | null> = {
      name: 'right',
      age: 'left',
    }
    await view.rerender({
      order: controlledOrder,
      widths: controlledWidths,
      pinned: controlledPinned,
    })
    await tick()

    const expectControlledState = (): void => {
      expect(get(columns.state).order).toEqual(['name'])
      expect(get(columns.state).widths).toEqual({ name: 310, age: 260 })
      expect(get(columns.state).pinned).toEqual({ name: 'right', age: 'left' })
      expect(columns.model.get().order).toEqual(['name'])
      expect(columns.model.get().widths).toEqual({ name: 310, age: 260 })
      expect(columns.model.get().pinned).toEqual({ name: 'right', age: 'left' })
    }
    expectControlledState()

    const expectAfter = async (write: () => void): Promise<void> => {
      write()
      expectControlledState()
      await tick()
      expectControlledState()
    }

    await expectAfter(() => columns.setOrder(['age', 'name']))
    await expectAfter(() => columns.setWidths({ name: 120 }))
    await expectAfter(() => columns.setWidth('age', 140))
    await expectAfter(() => columns.resetWidths())
    await expectAfter(() => columns.setPinned('name', null))
    await expectAfter(() => columns.clearOrder())

    expect(controlledOrder).toEqual(['name'])
    expect(controlledWidths).toEqual({ name: 310, age: 260 })
    expect(controlledPinned).toEqual({ name: 'right', age: 'left' })
    expect(onOrderChange.mock.calls).toEqual([[['age', 'name']], [undefined]])
    expect(onWidthsChange.mock.calls).toEqual([[{ name: 120 }], [{ name: 310, age: 140 }], [{}]])
    expect(onPinnedChange).toHaveBeenCalledTimes(1)
    expect(onPinnedChange).toHaveBeenCalledWith('name', null)
    expect(events).toEqual([
      { channel: 'order', order: ['age', 'name'] },
      { channel: 'widths', widths: { name: 120 } },
      { channel: 'widths', widths: { name: 310, age: 140 } },
      { channel: 'widths', widths: {} },
      {
        channel: 'pinned',
        key: 'name',
        side: null,
        pinned: { name: null, age: 'left' },
      },
      { channel: 'order', order: undefined },
    ])

    const callbackCounts = [
      onOrderChange.mock.calls.length,
      onWidthsChange.mock.calls.length,
      onPinnedChange.mock.calls.length,
      events.length,
    ]
    await view.rerender({ order: undefined, widths: undefined, pinned: undefined })
    await tick()

    expect(get(columns.state).order).toEqual(['age', 'name'])
    expect(get(columns.state).widths).toEqual({ name: 116, age: 216 })
    expect(get(columns.state).pinned).toEqual({ name: null, age: 'right' })
    expect(columns.model.get().order).toEqual(['age', 'name'])
    expect(columns.model.get().widths).toEqual({ name: 116, age: 216 })
    expect(columns.model.get().pinned).toEqual({ name: null, age: 'right' })
    expect([
      onOrderChange.mock.calls.length,
      onWidthsChange.mock.calls.length,
      onPinnedChange.mock.calls.length,
      events.length,
    ]).toEqual(callbackCounts)
    view.unmount()
  })

  it('bridges the shared rows and selection stores into Svelte stores', async () => {
    const view = render(GridBridgeHarness)
    const selectionButton = view.getByRole('button', { name: '2:a:40' })
    expect(selectionButton.textContent).toContain('2:a:40')
    await selectionButton.click()
    expect(view.getByRole('button', { name: '2:a,b:40' }).textContent).toContain('2:a,b:40')
  })

  it('routes nested row mutations through tree accessors', async () => {
    const view = render(GridBridgeHarness)
    expect(view.getByTestId('tree-child').textContent).toBe('Child')
    await view.getByRole('button', { name: 'update nested' }).click()
    expect(view.getByTestId('tree-child').textContent).toBe('Updated')
    await view.getByRole('button', { name: 'remove nested' }).click()
    expect(view.getByTestId('tree-child').textContent).toBe('')
  })

  it('syncs accepted controlled selection props into the existing model silently', async () => {
    let core!: GridCore<{ id: string }>
    let model!: SelectionModel<string>
    let selection!: Readable<string[]>
    const onChange = vi.fn()
    const view = render(GridSelectionControlledHarness, {
      props: {
        value: ['a'],
        onChange,
        onCore: (value) => (core = value),
        onModel: (value) => (model = value),
        onSelection: (value) => (selection = value),
      },
    })
    await tick()

    expect(view.getByTestId('selection').textContent).toBe('["a"]')
    expect(get(selection)).toEqual(['a'])
    expect(model.get()).toEqual(['a'])
    const initialModel = model
    onChange.mockReset()

    await view.rerender({ value: ['b'] })
    await tick()

    expect(view.getByTestId('selection').textContent).toBe('["b"]')
    expect(get(selection)).toEqual(['b'])
    expect(model.get()).toEqual(['b'])
    expect(onChange).not.toHaveBeenCalled()
    expect(model).toBe(initialModel)
    expect(core.invoke<SelectionModel<string>>('getSelectionModel')).toBe(initialModel)
  })

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

  it('isolates virtual snapshots while preserving scroll windows', async () => {
    let core!: GridCore<{ id: string }>
    let model!: GridVirtualModel
    let state!: Readable<VirtualizerState>
    const view = render(GridVirtualBridgeHarness, {
      props: {
        items: Array.from({ length: 5 }, (_, index) => ({ id: String(index) })),
        estimateSize: 20,
        viewportSize: 40,
        buffer: 0,
        onCore: (value) => (core = value),
        onModel: (value) => (model = value),
        onState: (value) => (state = value),
      },
    })
    await tick()

    const initial = get(state)
    const internal = model.store.getState()
    const expectWindow = (snapshot: VirtualizerState, indexes: number[], starts: number[]) => {
      expect(snapshot.totalSize).toBe(100)
      expect(snapshot.items.map((item) => item.index)).toEqual(indexes)
      expect(snapshot.items.map((item) => item.start)).toEqual(starts)
      expect(snapshot.items.every((item) => item.size === 20)).toBe(true)
    }

    expect(model).toBe(core.invoke('getVirtualModel'))
    expect(initial).not.toBe(internal)
    expect(initial.items).not.toBe(internal.items)
    expect(initial.items[0]).not.toBe(internal.items[0])
    expectWindow(initial, [0, 1], [0, 20])
    expect(view.getByTestId('virtual-total-size').textContent).toBe('100')
    expect(JSON.parse(view.getByTestId('virtual-indexes').textContent ?? '[]')).toEqual([0, 1])

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
    await tick()
    expectWindow(get(state), [1, 2], [20, 40])
    expect(view.getByTestId('virtual-total-size').textContent).toBe('100')
    expect(JSON.parse(view.getByTestId('virtual-indexes').textContent ?? '[]')).toEqual([1, 2])

    const emitted = get(state)
    emitted.offsetBefore = 999
    emitted.totalSize = 999
    emitted.items[0]!.start = 999
    emitted.items.length = 0
    expectWindow(model.store.getState(), [1, 2], [20, 40])
    expectWindow(model.getState(), [1, 2], [20, 40])

    model.setScroll(40)
    await tick()
    expectWindow(get(state), [2, 3], [40, 60])
    expect(view.getByTestId('virtual-total-size').textContent).toBe('100')
    expect(JSON.parse(view.getByTestId('virtual-indexes').textContent ?? '[]')).toEqual([2, 3])
    view.unmount()
  })

  it('syncs reactive items and viewport into the existing virtual model', async () => {
    let core!: GridCore<{ id: string }>
    let model!: GridVirtualModel
    const view = render(GridVirtualBridgeHarness, {
      props: {
        items: [{ id: 'a' }],
        estimateSize: 20,
        viewportSize: 20,
        buffer: 0,
        scrollOffset: 0,
        onCore: (value) => (core = value),
        onModel: (value) => (model = value),
      },
    })
    await tick()
    const initialModel = model

    await view.rerender({ items: [{ id: 'a' }, { id: 'b' }, { id: 'c' }], viewportSize: 60 })
    await tick()

    expect(view.getByTestId('virtual-total-size').textContent).toBe('60')
    expect(JSON.parse(view.getByTestId('virtual-indexes').textContent ?? '[]')).toEqual([0, 1, 2])
    expect(initialModel.getState().totalSize).toBe(60)
    expect(initialModel.getState().items.map((item) => item.index)).toEqual([0, 1, 2])
    expect(core.invoke<GridVirtualModel>('getVirtualModel')).toBe(initialModel)
    expect(
      view.container.querySelector('[data-model-identity]')?.getAttribute('data-model-identity'),
    ).toBe('true')
  })

  it('syncs estimate, buffer, and scroll into the existing virtual model', async () => {
    let core!: GridCore<{ id: string }>
    let model!: GridVirtualModel
    const view = render(GridVirtualBridgeHarness, {
      props: {
        items: Array.from({ length: 5 }, (_, index) => ({ id: String(index) })),
        estimateSize: 20,
        viewportSize: 20,
        buffer: 0,
        scrollOffset: 0,
        getItemKey: (item) => item.id,
        onCore: (value) => (core = value),
        onModel: (value) => (model = value),
      },
    })
    await tick()
    const initialModel = model
    const readIndexes = (): number[] =>
      JSON.parse(view.getByTestId('virtual-indexes').textContent ?? '[]')

    await view.rerender({ estimateSize: 30 })
    await tick()
    expect(view.getByTestId('virtual-total-size').textContent).toBe('150')
    expect(initialModel.getState().totalSize).toBe(150)
    expect(core.invoke<GridVirtualModel>('getVirtualModel')).toBe(initialModel)

    await view.rerender({ buffer: 1 })
    await tick()
    expect(readIndexes()).toEqual([0, 1])
    expect(initialModel.getState().items.map((item) => item.index)).toEqual([0, 1])
    expect(core.invoke<GridVirtualModel>('getVirtualModel')).toBe(initialModel)

    await view.rerender({ scrollOffset: 60 })
    await tick()
    expect(readIndexes()).toEqual([1, 2, 3])
    expect(initialModel.getState().items.map((item) => item.index)).toEqual([1, 2, 3])
    expect(core.invoke<GridVirtualModel>('getVirtualModel')).toBe(initialModel)
  })
})
