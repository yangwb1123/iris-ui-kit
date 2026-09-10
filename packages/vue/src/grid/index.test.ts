import { defineComponent, h, nextTick, type PropType } from 'vue'
import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import {
  GRID_COLUMNS_CHANGE_EVENT,
  GRID_FILTERING_CHANGE_EVENT,
  GRID_PAGINATION_CHANGE_EVENT,
  GRID_ROWS_CHANGE_EVENT,
  GRID_SELECTION_CHANGE_EVENT,
  GRID_SORTING_CHANGE_EVENT,
  type GridColumnsChange,
  type GridColumnsModel,
  type GridCore,
  type GridFilterValues,
  type GridFilteringModel,
  type GridRowsModel,
  type GridSortingModel,
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

describe('Vue Grid Core bridge', () => {
  it('preserves initial controlled selection and single-sort baselines across a no-op handoff detour', async () => {
    const selectionA = ['a']
    const selectionB = ['b']
    const sortA: SortState = { key: 'name', direction: 'asc' }
    const sortB: SortState = { key: 'age', direction: 'desc' }
    const onChange = vi.fn()
    const onSortChange = vi.fn()
    const selectionEvent = vi.fn()
    const sortingEvent = vi.fn()
    let selection!: ReturnType<typeof useGridSelection>
    let sorting!: ReturnType<typeof useGridSorting>
    let core!: GridCore
    const Harness = defineComponent({
      props: {
        value: Array as PropType<string[]>,
        sort: Object as PropType<SortState>,
        onChange: Function as PropType<(keys: string[]) => void>,
        onSortChange: Function as PropType<(sort: SortState | null) => void>,
      },
      setup(props) {
        core = useGridCore()
        selection = useGridSelection(core, props)
        sorting = useGridSorting(core, props)
        core.on(GRID_SELECTION_CHANGE_EVENT, selectionEvent)
        core.on(GRID_SORTING_CHANGE_EVENT, sortingEvent)
        return () => h('div')
      },
    })

    const wrapper = mount(Harness, {
      props: { value: selectionA, sort: sortA, onChange, onSortChange },
    })
    expect(selection.selection.value).toEqual(selectionA)
    expect(selection.model.get()).toEqual(selectionA)
    expect(sorting.sort.value).toEqual(sortA)
    expect(sorting.model.get().sort).toEqual(sortA)
    vi.clearAllMocks()

    await wrapper.setProps({ value: undefined, sort: undefined })
    await nextTick()
    expect(selection.selection.value).toEqual(selectionA)
    expect(selection.model.get()).toEqual(selectionA)
    expect(sorting.sort.value).toEqual(sortA)
    expect(sorting.model.get().sort).toEqual(sortA)

    await wrapper.setProps({ value: selectionB, sort: sortB })
    await nextTick()
    expect(selection.selection.value).toEqual(selectionB)
    expect(selection.model.get()).toEqual(selectionB)
    expect(sorting.sort.value).toEqual(sortB)
    expect(sorting.model.get().sort).toEqual(sortB)

    await wrapper.setProps({ value: undefined, sort: undefined })
    await nextTick()
    expect(selection.selection.value).toEqual(selectionA)
    expect(selection.model.get()).toEqual(selectionA)
    expect(sorting.sort.value).toEqual(sortA)
    expect(sorting.model.get().sort).toEqual(sortA)
    expect(onChange).not.toHaveBeenCalled()
    expect(onSortChange).not.toHaveBeenCalled()
    expect(selectionEvent).not.toHaveBeenCalled()
    expect(sortingEvent).not.toHaveBeenCalled()
    wrapper.unmount()
  })

  it('rebases rejected controlled selection before synchronous toggles', () => {
    const onChange = vi.fn()
    let selection!: ReturnType<typeof useGridSelection>
    const Harness = defineComponent({
      props: {
        mode: {
          type: String as PropType<'single' | 'multiple'>,
          default: 'multiple',
        },
        value: Array as PropType<string[]>,
        onChange: Function as PropType<(keys: string[]) => void>,
      },
      setup(props) {
        const core = useGridCore()
        selection = useGridSelection(core, props)
        return () =>
          h('output', { 'data-testid': 'selection' }, JSON.stringify(selection.selection.value))
      },
    })

    const wrapper = mount(Harness, {
      props: { mode: 'multiple', value: ['a'], onChange },
    })
    expect(selection.selection.value).toEqual(['a'])
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
    expect(selection.selection.value).toEqual(['a'])
    expect(wrapper.get('[data-testid="selection"]').text()).toBe('["a"]')
    wrapper.unmount()
  })

  it('installs columns on the supplied core and keeps inbound sync silent', () => {
    let core: GridCore<{ id: string }> | undefined
    let columns: ReturnType<typeof useGridColumns> | undefined
    const onVisibilityChange = vi.fn()
    const onWidthsChange = vi.fn()
    const Harness = defineComponent({
      setup() {
        core = useGridCore<{ id: string }>()
        useGridRows(core, [{ id: 'a' }])
        useGridSelection(core, { defaultValue: ['a'] })
        columns = useGridColumns(core, { onVisibilityChange, onWidthsChange })
        return () => h('div')
      },
    })

    const wrapper = mount(Harness)
    const feature = columns!
    expect(core!.features.filter((name) => name === 'columns')).toHaveLength(1)
    expect(feature.model).toBe(core!.invoke<GridColumnsModel>('getColumnsModel'))

    feature.model.syncVisibility({ hidden: false })
    feature.model.syncWidths({ name: 120 })
    expect(onVisibilityChange).not.toHaveBeenCalled()
    expect(onWidthsChange).not.toHaveBeenCalled()

    feature.setWidths({ name: 140 })
    feature.setVisibility({ hidden: true })
    expect(onWidthsChange).toHaveBeenCalledWith({ name: 140 })
    expect(onVisibilityChange).toHaveBeenCalledWith({ hidden: true })

    wrapper.unmount()
    expect(core!.status).toBe('destroyed')
  })

  it('rebases rejected controlled column proposals from accepted props', async () => {
    let core!: GridCore
    let columns!: ReturnType<typeof useGridColumns>
    const accepted = {
      visibility: { hidden: false },
      order: ['name'],
      widths: { name: 310, age: 260 },
      pinned: { name: 'right' as const, age: 'left' as const },
    }
    const onVisibilityChange = vi.fn()
    const onOrderChange = vi.fn()
    const onWidthsChange = vi.fn()
    const onPinnedChange = vi.fn()
    const events: GridColumnsChange[] = []
    const Harness = defineComponent({
      props: {
        visibility: Object as PropType<Record<string, boolean>>,
        order: Array as PropType<string[]>,
        orderControlled: { type: Boolean, default: undefined },
        widths: Object as PropType<Record<string, number>>,
        pinned: Object as PropType<Record<string, 'left' | 'right' | null>>,
        onVisibilityChange: Function as PropType<(value: Record<string, boolean>) => void>,
        onOrderChange: Function as PropType<(value: string[] | undefined) => void>,
        onWidthsChange: Function as PropType<(value: Record<string, number>) => void>,
        onPinnedChange: Function as PropType<(key: string, side: 'left' | 'right' | null) => void>,
      },
      setup(props) {
        core = useGridCore()
        columns = useGridColumns(core, props)
        return () =>
          h('output', { 'data-testid': 'column-state' }, JSON.stringify(columns.state.value))
      },
    })
    const wrapper = mount(Harness, {
      props: {
        ...accepted,
        onVisibilityChange,
        onOrderChange,
        onWidthsChange,
        onPinnedChange,
      },
    })
    core.on(GRID_COLUMNS_CHANGE_EVENT, (event) => events.push(event))

    const expectAccepted = (): void => {
      expect(columns.state.value).toEqual(accepted)
      expect(columns.model.get()).toEqual(accepted)
      expect(columns.model.store.getState()).toEqual(accepted)
    }
    const expectRejected = async (proposal: () => void): Promise<void> => {
      proposal()
      expectAccepted()
      expect(wrapper.get('[data-testid="column-state"]').text()).toBe(JSON.stringify(accepted))
      await nextTick()
      expectAccepted()
      expect(wrapper.get('[data-testid="column-state"]').text()).toBe(JSON.stringify(accepted))
    }

    expectAccepted()
    await expectRejected(() => columns.setVisibility({ hidden: true }))
    await expectRejected(() => columns.setOrder(['age', 'name']))
    await expectRejected(() => columns.setWidths({ name: 120 }))
    await expectRejected(() => columns.setWidth('age', 140))
    await expectRejected(() => columns.resetWidths())
    await expectRejected(() => columns.setPinned('name', null))
    await expectRejected(() => columns.clearOrder())

    expect(onVisibilityChange).toHaveBeenCalledWith({ hidden: true })
    expect(onOrderChange.mock.calls).toEqual([[['age', 'name']], [undefined]])
    expect(onWidthsChange.mock.calls).toEqual([[{ name: 120 }], [{ name: 310, age: 140 }], [{}]])
    expect(onPinnedChange).toHaveBeenCalledWith('name', null)
    expect(events).toEqual([
      { channel: 'visibility', visibility: { hidden: true } },
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
    expect(accepted).toEqual({
      visibility: { hidden: false },
      order: ['name'],
      widths: { name: 310, age: 260 },
      pinned: { name: 'right', age: 'left' },
    })
    wrapper.unmount()
  })

  it('rebases controlled column proposals before a batched store notification', () => {
    const onOrderChange = vi.fn()
    const acceptedOrder = ['name']
    let columns!: ReturnType<typeof useGridColumns>
    const Harness = defineComponent({
      props: {
        order: Array as PropType<string[]>,
        onOrderChange: Function as PropType<(value: string[] | undefined) => void>,
      },
      setup(props) {
        const core = useGridCore()
        columns = useGridColumns(core, props)
        return () => h('div')
      },
    })

    const wrapper = mount(Harness, { props: { order: acceptedOrder, onOrderChange } })
    columns.model.store.batch(() => {
      columns.setOrder(['age'])
      expect(columns.model.get().order).toEqual(acceptedOrder)
      expect(columns.model.store.getState().order).toEqual(acceptedOrder)
    })
    expect(columns.state.value.order).toEqual(acceptedOrder)
    expect(onOrderChange).toHaveBeenCalledOnce()
    expect(onOrderChange).toHaveBeenCalledWith(['age'])
    wrapper.unmount()
  })

  it('treats an explicitly controlled empty order as authoritative', async () => {
    const onOrderChange = vi.fn()
    let columns!: ReturnType<typeof useGridColumns>
    const Harness = defineComponent({
      props: {
        order: Array as PropType<string[]>,
        orderControlled: { type: Boolean, default: undefined },
        defaultOrder: Array as PropType<string[]>,
        onOrderChange: Function as PropType<(value: string[] | undefined) => void>,
      },
      setup(props) {
        const core = useGridCore()
        columns = useGridColumns(core, props)
        return () => h('output', JSON.stringify(columns.state.value.order))
      },
    })

    const wrapper = mount(Harness, {
      props: { orderControlled: true, defaultOrder: ['name'], onOrderChange },
    })
    expect(columns.state.value.order).toEqual([])
    expect(columns.model.get().order).toEqual([])
    columns.setOrder(['age'])
    expect(columns.state.value.order).toEqual([])
    expect(columns.model.get().order).toEqual([])
    columns.clearOrder()
    await nextTick()
    expect(columns.state.value.order).toEqual([])
    expect(columns.model.store.getState().order).toEqual([])
    expect(onOrderChange.mock.calls).toEqual([[['age']], [undefined]])
    wrapper.unmount()
  })

  it('keeps accepted column updates and independent snapshots across rejected handoffs', async () => {
    const uncontrolled = {
      visibility: { hidden: false },
      order: ['age', 'name'],
      widths: { name: 116, age: 216 },
      pinned: { name: null as const, age: 'right' as const },
    }
    const acceptedA = {
      visibility: { hidden: false },
      order: ['name'],
      widths: { name: 310, age: 260 },
      pinned: { name: 'right' as const, age: 'left' as const },
    }
    const acceptedB = {
      visibility: { hidden: true },
      order: ['age'],
      widths: { name: 400, age: 280 },
      pinned: { name: 'left' as const, age: null as const },
    }
    const onVisibilityChange = vi.fn()
    const onOrderChange = vi.fn()
    const onWidthsChange = vi.fn()
    const onPinnedChange = vi.fn()
    let columns!: ReturnType<typeof useGridColumns>
    const Harness = defineComponent({
      props: {
        visibility: Object as PropType<Record<string, boolean>>,
        order: Array as PropType<string[]>,
        widths: Object as PropType<Record<string, number>>,
        pinned: Object as PropType<Record<string, 'left' | 'right' | null>>,
        defaultVisibility: Object as PropType<Record<string, boolean>>,
        defaultOrder: Array as PropType<string[]>,
        defaultWidths: Object as PropType<Record<string, number>>,
        defaultPinned: Object as PropType<Record<string, 'left' | 'right' | null>>,
        onVisibilityChange: Function as PropType<(value: Record<string, boolean>) => void>,
        onOrderChange: Function as PropType<(value: string[] | undefined) => void>,
        onWidthsChange: Function as PropType<(value: Record<string, number>) => void>,
        onPinnedChange: Function as PropType<(key: string, side: 'left' | 'right' | null) => void>,
      },
      setup(props) {
        const core = useGridCore()
        columns = useGridColumns(core, props)
        return () => h('div')
      },
    })
    const wrapper = mount(Harness, {
      props: {
        defaultVisibility: { hidden: true },
        defaultOrder: ['name', 'age'],
        defaultWidths: { name: 100, age: 200 },
        defaultPinned: { name: 'left', age: 'right' },
        onVisibilityChange,
        onOrderChange,
        onWidthsChange,
        onPinnedChange,
      },
    })

    columns.setVisibility(uncontrolled.visibility)
    columns.setOrder(uncontrolled.order)
    columns.setWidths(uncontrolled.widths)
    columns.setPinned('name', uncontrolled.pinned.name)
    const localCallbackCounts = {
      visibility: onVisibilityChange.mock.calls.length,
      order: onOrderChange.mock.calls.length,
      widths: onWidthsChange.mock.calls.length,
      pinned: onPinnedChange.mock.calls.length,
    }

    await wrapper.setProps(acceptedA)
    await nextTick()
    expect(columns.model.get()).toEqual(acceptedA)
    expect(columns.state.value).toEqual(acceptedA)
    expect(onVisibilityChange).toHaveBeenCalledTimes(localCallbackCounts.visibility)
    expect(onOrderChange).toHaveBeenCalledTimes(localCallbackCounts.order)
    expect(onWidthsChange).toHaveBeenCalledTimes(localCallbackCounts.widths)
    expect(onPinnedChange).toHaveBeenCalledTimes(localCallbackCounts.pinned)

    await wrapper.setProps(acceptedB)
    await nextTick()
    expect(columns.model.get()).toEqual(acceptedB)
    expect(columns.state.value).toEqual(acceptedB)
    const acceptedCallbackCounts = {
      visibility: onVisibilityChange.mock.calls.length,
      order: onOrderChange.mock.calls.length,
      widths: onWidthsChange.mock.calls.length,
      pinned: onPinnedChange.mock.calls.length,
    }

    columns.setVisibility({ hidden: false })
    columns.setOrder(['rejected'])
    columns.setWidths({ name: 1 })
    columns.setWidth('age', 140)
    expect(onWidthsChange).toHaveBeenLastCalledWith({ name: 400, age: 140 })
    columns.resetWidths()
    columns.setPinned('name', null)
    columns.clearOrder()
    expect(columns.model.get()).toEqual(acceptedB)
    expect(columns.state.value).toEqual(acceptedB)
    expect(onVisibilityChange.mock.calls.length).toBeGreaterThan(acceptedCallbackCounts.visibility)
    expect(onOrderChange.mock.calls.length).toBeGreaterThan(acceptedCallbackCounts.order)
    expect(onWidthsChange.mock.calls.length).toBeGreaterThan(acceptedCallbackCounts.widths)
    expect(onPinnedChange.mock.calls.length).toBeGreaterThan(acceptedCallbackCounts.pinned)

    expect(acceptedA).toEqual({
      visibility: { hidden: false },
      order: ['name'],
      widths: { name: 310, age: 260 },
      pinned: { name: 'right', age: 'left' },
    })
    expect(acceptedB).toEqual({
      visibility: { hidden: true },
      order: ['age'],
      widths: { name: 400, age: 280 },
      pinned: { name: 'left', age: null },
    })

    const handoffCallbackCounts = {
      visibility: onVisibilityChange.mock.calls.length,
      order: onOrderChange.mock.calls.length,
      widths: onWidthsChange.mock.calls.length,
      pinned: onPinnedChange.mock.calls.length,
    }
    await wrapper.setProps({
      visibility: undefined,
      order: undefined,
      widths: undefined,
      pinned: undefined,
    })
    await nextTick()
    expect(columns.model.get()).toEqual(uncontrolled)
    expect(columns.model.store.getState()).toEqual(uncontrolled)
    expect(columns.state.value).toEqual(uncontrolled)
    expect(onVisibilityChange).toHaveBeenCalledTimes(handoffCallbackCounts.visibility)
    expect(onOrderChange).toHaveBeenCalledTimes(handoffCallbackCounts.order)
    expect(onWidthsChange).toHaveBeenCalledTimes(handoffCallbackCounts.widths)
    expect(onPinnedChange).toHaveBeenCalledTimes(handoffCallbackCounts.pinned)
    wrapper.unmount()
  })

  it('keeps uncontrolled filtering snapshots detached from Core state', async () => {
    const onFiltersChange = vi.fn()
    const onFilterValuesChange = vi.fn()
    const filteringEvent = vi.fn()
    const storeObserver = vi.fn()
    let core!: GridCore
    let filtering!: ReturnType<typeof useGridFiltering>
    const Harness = defineComponent({
      setup() {
        core = useGridCore()
        filtering = useGridFiltering(core, {
          defaultFilters: { status: 'active' },
          defaultFilterValues: { status: ['active', 'pending'] },
          onFiltersChange,
          onFilterValuesChange,
        })
        return () => h('div')
      },
    })

    const wrapper = mount(Harness)
    const unsubscribeEvent = core.on(GRID_FILTERING_CHANGE_EVENT, filteringEvent)
    const unsubscribeStore = filtering.model.store.subscribe(storeObserver)
    const initial = filtering.model.get()
    const callbackCounts = {
      filters: onFiltersChange.mock.calls.length,
      filterValues: onFilterValuesChange.mock.calls.length,
      events: filteringEvent.mock.calls.length,
      store: storeObserver.mock.calls.length,
    }
    const filtersSnapshot = filtering.filters.value
    const filterValuesSnapshot = filtering.filterValues.value

    filtersSnapshot.status = 'paused'
    filterValuesSnapshot.status!.push('archived')
    await nextTick()

    expect(filtering.model.get()).toEqual(initial)
    expect(filtering.model.store.getState()).toEqual(initial)
    expect(onFiltersChange).toHaveBeenCalledTimes(callbackCounts.filters)
    expect(onFilterValuesChange).toHaveBeenCalledTimes(callbackCounts.filterValues)
    expect(filteringEvent).toHaveBeenCalledTimes(callbackCounts.events)
    expect(storeObserver).toHaveBeenCalledTimes(callbackCounts.store)

    unsubscribeStore()
    unsubscribeEvent()
    wrapper.unmount()
  })

  it('keeps controlled inputs isolated from mutable bridge snapshots', async () => {
    const filters = { status: 'active' }
    const filterValues = { status: ['active', 'pending'] }
    const onFiltersChange = vi.fn()
    const onFilterValuesChange = vi.fn()
    const filteringEvent = vi.fn()
    const storeObserver = vi.fn()
    let core!: GridCore
    let filtering!: ReturnType<typeof useGridFiltering>
    const Harness = defineComponent({
      props: {
        filters: Object as PropType<Record<string, string>>,
        filterValues: Object as PropType<GridFilterValues>,
        onFiltersChange: Function as PropType<(filters: Record<string, string>) => void>,
        onFilterValuesChange: Function as PropType<(values: GridFilterValues) => void>,
      },
      setup(props) {
        core = useGridCore()
        filtering = useGridFiltering(core, props)
        return () => h('div')
      },
    })

    const wrapper = mount(Harness, {
      props: { filters, filterValues, onFiltersChange, onFilterValuesChange },
    })
    const unsubscribeEvent = core.on(GRID_FILTERING_CHANGE_EVENT, filteringEvent)
    const unsubscribeStore = filtering.model.store.subscribe(storeObserver)
    const initial = filtering.model.get()
    const callbackCounts = {
      filters: onFiltersChange.mock.calls.length,
      filterValues: onFilterValuesChange.mock.calls.length,
      events: filteringEvent.mock.calls.length,
      store: storeObserver.mock.calls.length,
    }
    const filtersSnapshot = filtering.filters.value
    const filterValuesSnapshot = filtering.filterValues.value

    expect(filtersSnapshot).not.toBe(filters)
    expect(filterValuesSnapshot).not.toBe(filterValues)
    expect(filterValuesSnapshot.status).not.toBe(filterValues.status)

    filtersSnapshot.status = 'paused'
    filterValuesSnapshot.status!.push('archived')
    await nextTick()

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
    wrapper.unmount()
  })

  it('hides rejected controlled composite proposals and restores accepted snapshots', async () => {
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
    let core!: GridCore
    let sorting!: ReturnType<typeof useGridSorting>
    let filtering!: ReturnType<typeof useGridFiltering>
    const Harness = defineComponent({
      props: {
        mode: {
          type: String as PropType<'single' | 'multiple'>,
          default: 'multiple',
        },
        multiSortState: Array as PropType<SortState[]>,
        filters: Object as PropType<Record<string, string>>,
        filterValues: Object as PropType<GridFilterValues>,
        onMultiSortChange: Function as PropType<(sorts: SortState[]) => void>,
        onFiltersChange: Function as PropType<(filters: Record<string, string>) => void>,
        onFilterValuesChange: Function as PropType<(values: GridFilterValues) => void>,
      },
      setup(props) {
        core = useGridCore()
        sorting = useGridSorting(core, props)
        filtering = useGridFiltering(core, props)
        return () => h('div')
      },
    })

    const wrapper = mount(Harness, {
      props: {
        multiSortState: acceptedMultiSort,
        filters: acceptedFilters,
        filterValues: acceptedFilterValues,
        onMultiSortChange,
        onFiltersChange,
        onFilterValuesChange,
      },
    })
    core.on(GRID_SORTING_CHANGE_EVENT, sortingEvent)
    core.on(GRID_FILTERING_CHANGE_EVENT, filteringEvent)

    const sortSnapshot = sorting.multiSort.value
    const filtersSnapshot = filtering.filters.value
    const filterValuesSnapshot = filtering.filterValues.value
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

    sorting.model.setMultiSort(rejectedMultiSort)
    filtering.model.setFilters(rejectedFilters)
    filtering.model.setFilterValues(rejectedFilterValues)
    expect(sorting.multiSort.value).toEqual(acceptedMultiSort)
    expect(filtering.filters.value).toEqual(acceptedFilters)
    expect(filtering.filterValues.value).toEqual(acceptedFilterValues)
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

    await wrapper.setProps({
      multiSortState: undefined,
      filters: undefined,
      filterValues: undefined,
    })
    await nextTick()
    expect(sorting.multiSort.value).toEqual(acceptedMultiSort)
    expect(filtering.filters.value).toEqual(acceptedFilters)
    expect(filtering.filterValues.value).toEqual(acceptedFilterValues)
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
    wrapper.unmount()
  })

  it('retains the first controlled snapshot across a no-op handoff and later detour', async () => {
    const firstMultiSort: SortState[] = [{ key: 'name', direction: 'asc' }]
    const firstFilters = { status: 'active' }
    const firstFilterValues: GridFilterValues = { status: ['active'] }
    const secondMultiSort: SortState[] = [{ key: 'age', direction: 'desc' }]
    const secondFilters = { status: 'paused' }
    const secondFilterValues: GridFilterValues = { status: ['paused'] }
    const rejectedMultiSort: SortState[] = [{ key: 'id', direction: 'asc' }]
    const rejectedFilters = { status: 'rejected' }
    const rejectedFilterValues: GridFilterValues = { status: ['rejected'] }
    let sorting!: ReturnType<typeof useGridSorting>
    let filtering!: ReturnType<typeof useGridFiltering>
    const Harness = defineComponent({
      props: {
        multiSortState: Array as PropType<SortState[]>,
        filters: Object as PropType<Record<string, string>>,
        filterValues: Object as PropType<GridFilterValues>,
      },
      setup(props) {
        const core = useGridCore()
        sorting = useGridSorting(core, props)
        filtering = useGridFiltering(core, props)
        return () => h('div')
      },
    })

    const wrapper = mount(Harness, {
      props: {
        multiSortState: firstMultiSort,
        filters: firstFilters,
        filterValues: firstFilterValues,
      },
    })
    await wrapper.setProps({
      multiSortState: undefined,
      filters: undefined,
      filterValues: undefined,
    })
    await nextTick()
    expect(sorting.multiSort.value).toEqual(firstMultiSort)
    expect(filtering.filters.value).toEqual(firstFilters)
    expect(filtering.filterValues.value).toEqual(firstFilterValues)

    const uncontrolledMultiSort = sorting.multiSort.value
    const uncontrolledFilters = filtering.filters.value
    const uncontrolledFilterValues = filtering.filterValues.value
    uncontrolledMultiSort[0]!.direction = 'desc'
    uncontrolledFilters.status = 'local'
    uncontrolledFilterValues.status!.push('local')
    expect(sorting.model.store.getState()).toEqual({ sort: null, multiSort: firstMultiSort })
    expect(filtering.model.store.getState()).toEqual({
      filters: firstFilters,
      filterValues: firstFilterValues,
    })

    await wrapper.setProps({
      multiSortState: secondMultiSort,
      filters: secondFilters,
      filterValues: secondFilterValues,
    })
    expect(sorting.multiSort.value).toEqual(secondMultiSort)
    expect(filtering.filters.value).toEqual(secondFilters)
    expect(filtering.filterValues.value).toEqual(secondFilterValues)

    sorting.model.setMultiSort(rejectedMultiSort)
    filtering.model.setFilters(rejectedFilters)
    filtering.model.setFilterValues(rejectedFilterValues)
    expect(sorting.multiSort.value).toEqual(secondMultiSort)
    expect(filtering.filters.value).toEqual(secondFilters)
    expect(filtering.filterValues.value).toEqual(secondFilterValues)

    await wrapper.setProps({
      multiSortState: undefined,
      filters: undefined,
      filterValues: undefined,
    })
    await nextTick()
    expect(sorting.multiSort.value).toEqual(firstMultiSort)
    expect(filtering.filters.value).toEqual(firstFilters)
    expect(filtering.filterValues.value).toEqual(firstFilterValues)
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
    wrapper.unmount()
  })

  it('hides rejected pagination proposals and restores accepted snapshots on handoff', async () => {
    const onChange = vi.fn()
    const paginationEvent = vi.fn()
    let pagination!: ReturnType<typeof useGridPagination>
    let core!: GridCore
    const Harness = defineComponent({
      props: {
        page: Number,
        defaultPage: Number,
        pageSize: Number,
        total: Number,
        onChange: Function as PropType<(change: unknown) => void>,
      },
      setup(props) {
        core = useGridCore()
        core.on(GRID_PAGINATION_CHANGE_EVENT, paginationEvent)
        pagination = useGridPagination(core, props)
        return () =>
          h('output', { 'data-testid': 'page' }, String(pagination.pagination.value.page))
      },
    })

    const wrapper = mount(Harness, {
      props: { page: 1, pageSize: 25, total: 101, onChange },
    })
    expect(wrapper.get('[data-testid="page"]').text()).toBe('1')

    pagination.setPage(2)
    expect(wrapper.get('[data-testid="page"]').text()).toBe('1')
    expect(onChange).toHaveBeenCalledOnce()
    expect(paginationEvent).toHaveBeenCalledOnce()

    await wrapper.setProps({ page: 3 })
    expect(wrapper.get('[data-testid="page"]').text()).toBe('3')
    pagination.setPage(4)
    expect(wrapper.get('[data-testid="page"]').text()).toBe('3')
    expect(onChange).toHaveBeenCalledTimes(2)
    expect(paginationEvent).toHaveBeenCalledTimes(2)

    await wrapper.setProps({ page: undefined })
    await nextTick()
    expect(wrapper.get('[data-testid="page"]').text()).toBe('3')
    expect(pagination.model.get().page).toBe(3)
    expect(onChange).toHaveBeenCalledTimes(2)
    expect(paginationEvent).toHaveBeenCalledTimes(2)
    wrapper.unmount()

    const detour = mount(Harness, {
      props: { defaultPage: 7, pageSize: 25, total: 101, onChange },
    })
    expect(detour.get('[data-testid="page"]').text()).toBe('7')
    await detour.setProps({ page: 1 })
    pagination.setPage(2)
    expect(detour.get('[data-testid="page"]').text()).toBe('1')
    await detour.setProps({ page: undefined })
    await nextTick()
    expect(detour.get('[data-testid="page"]').text()).toBe('7')
    expect(pagination.model.get().page).toBe(7)
    expect(onChange).toHaveBeenCalledTimes(3)
    expect(paginationEvent).toHaveBeenCalledTimes(3)
    detour.unmount()
  })

  it('silences retained rows, sorting, and filtering models after unmount', () => {
    type Row = { id: number; name: string; status: string }
    let core: GridCore<Row> | undefined
    let rowsModel: GridRowsModel<Row> | undefined
    let sortingModel: GridSortingModel | undefined
    let filteringModel: GridFilteringModel | undefined
    const onBeforeRowsChange = vi.fn()
    const onRowsChange = vi.fn()
    const onSortChange = vi.fn()
    const onMultiSortChange = vi.fn()
    const onFiltersChange = vi.fn()
    const onFilterValuesChange = vi.fn()
    const rowsEvent = vi.fn()
    const sortingEvent = vi.fn()
    const filteringEvent = vi.fn()
    const Harness = defineComponent({
      setup() {
        core = useGridCore<Row>()
        rowsModel = useGridRows(core, [{ id: 1, name: 'Ada', status: 'active' }], {
          onBeforeRowsChange,
          onRowsChange,
        }).model
        sortingModel = useGridSorting(core, {
          mode: 'multiple',
          onSortChange,
          onMultiSortChange,
        }).model
        filteringModel = useGridFiltering(core, {
          onFiltersChange,
          onFilterValuesChange,
        }).model
        core.on(GRID_ROWS_CHANGE_EVENT, rowsEvent)
        core.on(GRID_SORTING_CHANGE_EVENT, sortingEvent)
        core.on(GRID_FILTERING_CHANGE_EVENT, filteringEvent)
        return () => h('div')
      },
    })

    const wrapper = mount(Harness)
    rowsModel!.commit([{ id: 2, name: 'Bea', status: 'paused' }])
    sortingModel!.setSort({ key: 'name', direction: 'asc' })
    sortingModel!.setMultiSort([{ key: 'status', direction: 'asc' }])
    filteringModel!.setFilter('name', 'a')
    filteringModel!.setColumnFilterValues('status', ['active'])

    expect(onBeforeRowsChange).toHaveBeenCalledOnce()
    expect(onRowsChange).toHaveBeenCalledOnce()
    expect(onSortChange).toHaveBeenCalledOnce()
    expect(onMultiSortChange).toHaveBeenCalledOnce()
    expect(onFiltersChange).toHaveBeenCalledOnce()
    expect(onFilterValuesChange).toHaveBeenCalledOnce()
    expect(rowsEvent).toHaveBeenCalledOnce()
    expect(sortingEvent).toHaveBeenCalledTimes(2)
    expect(filteringEvent).toHaveBeenCalledTimes(2)

    wrapper.unmount()
    expect(core!.status).toBe('destroyed')
    rowsModel!.commit([{ id: 3, name: 'Cora', status: 'active' }])
    sortingModel!.setSort({ key: 'name', direction: 'desc' })
    sortingModel!.setMultiSort([{ key: 'status', direction: 'desc' }])
    sortingModel!.clear()
    filteringModel!.setFilter('name', 'b')
    filteringModel!.setColumnFilterValues('status', ['paused'])
    filteringModel!.clear()

    expect(rowsModel!.getData()).toEqual([{ id: 3, name: 'Cora', status: 'active' }])
    expect(sortingModel!.get()).toEqual({
      sort: { key: 'name', direction: 'desc' },
      multiSort: [],
    })
    expect(filteringModel!.get()).toEqual({ filters: {}, filterValues: {} })
    expect(onBeforeRowsChange).toHaveBeenCalledOnce()
    expect(onRowsChange).toHaveBeenCalledOnce()
    expect(onSortChange).toHaveBeenCalledOnce()
    expect(onMultiSortChange).toHaveBeenCalledOnce()
    expect(onFiltersChange).toHaveBeenCalledOnce()
    expect(onFilterValuesChange).toHaveBeenCalledOnce()
    expect(rowsEvent).toHaveBeenCalledOnce()
    expect(sortingEvent).toHaveBeenCalledTimes(2)
    expect(filteringEvent).toHaveBeenCalledTimes(2)
    expect(() => core!.destroy()).not.toThrow()
  })

  it('restores the uncontrolled visibility snapshot across rejected control handoff', async () => {
    const Harness = defineComponent({
      props: {
        visibility: Object as PropType<Record<string, boolean>>,
        defaultVisibility: Object as PropType<Record<string, boolean>>,
      },
      setup(props) {
        const core = useGridCore()
        const columns = useGridColumns(core, props)
        return () =>
          h(
            'button',
            { onClick: () => columns.toggleVisibility('age') },
            String(columns.state.value.visibility.age),
          )
      },
    })

    const wrapper = mount(Harness, {
      props: { visibility: { age: false }, defaultVisibility: { age: false } },
    })
    expect(wrapper.text()).toBe('false')

    await wrapper.get('button').trigger('click')
    expect(wrapper.text()).toBe('false')

    await wrapper.setProps({ visibility: undefined })
    await nextTick()
    expect(wrapper.text()).toBe('false')

    await wrapper.setProps({ visibility: { age: true } })
    await nextTick()
    expect(wrapper.text()).toBe('true')
    await wrapper.setProps({ visibility: undefined })
    await nextTick()
    expect(wrapper.text()).toBe('false')
    wrapper.unmount()
  })

  it('restores the uncontrolled sort after a rejected controlled handoff', async () => {
    const A: SortState = { key: 'name', direction: 'asc' }
    const B: SortState = { key: 'age', direction: 'desc' }
    const C: SortState = { key: 'status', direction: 'asc' }
    const onSortChange = vi.fn()
    let sorting!: ReturnType<typeof useGridSorting>
    const Harness = defineComponent({
      props: {
        sort: Object as PropType<SortState | null>,
        defaultSort: Object as PropType<SortState | null>,
        onSortChange: Function as PropType<(sort: SortState | null) => void>,
      },
      setup(props) {
        const core = useGridCore()
        sorting = useGridSorting(core, props)
        return () => h('output', { 'data-testid': 'sort' }, JSON.stringify(sorting.sort.value))
      },
    })

    const wrapper = mount(Harness, { props: { defaultSort: A, onSortChange } })
    expect(sorting.sort.value).toEqual(A)

    await wrapper.setProps({ sort: B })
    await nextTick()
    expect(sorting.sort.value).toEqual(B)
    expect(sorting.model.get().sort).toEqual(B)
    expect(onSortChange).not.toHaveBeenCalled()

    sorting.model.setSort(C)
    expect(sorting.model.get().sort).toEqual(C)
    expect(sorting.sort.value).toEqual(B)
    expect(onSortChange).toHaveBeenLastCalledWith(C)
    const proposalCount = onSortChange.mock.calls.length

    await wrapper.setProps({ sort: undefined })
    await nextTick()
    expect(sorting.sort.value).toEqual(A)
    expect(sorting.model.get().sort).toEqual(A)
    expect(onSortChange).toHaveBeenCalledTimes(proposalCount)
    expect(wrapper.get('[data-testid="sort"]').text()).toBe(JSON.stringify(A))
    wrapper.unmount()
  })

  it('restores independent multi-sort and filtering snapshots after rejected detours', async () => {
    const defaultMultiSort: SortState[] = [{ key: 'default-multi', direction: 'asc' }]
    const defaultFilters = { default: 'filter' }
    const defaultFilterValues: GridFilterValues = { default: ['value'] }
    const onMultiSortChange = vi.fn()
    const onFiltersChange = vi.fn()
    const onFilterValuesChange = vi.fn()
    const sortingEvent = vi.fn()
    const filteringEvent = vi.fn()
    let core!: GridCore
    let sorting!: ReturnType<typeof useGridSorting>
    let filtering!: ReturnType<typeof useGridFiltering>
    const Harness = defineComponent({
      props: {
        mode: {
          type: String as PropType<'single' | 'multiple'>,
          default: 'multiple',
        },
        multiSortState: Array as PropType<SortState[]>,
        defaultMultiSort: Array as PropType<SortState[]>,
        filters: Object as PropType<Record<string, string>>,
        defaultFilters: Object as PropType<Record<string, string>>,
        filterValues: Object as PropType<GridFilterValues>,
        defaultFilterValues: Object as PropType<GridFilterValues>,
        onMultiSortChange: Function as PropType<(sorts: SortState[]) => void>,
        onFiltersChange: Function as PropType<(filters: Record<string, string>) => void>,
        onFilterValuesChange: Function as PropType<(values: GridFilterValues) => void>,
      },
      setup(props) {
        core = useGridCore()
        sorting = useGridSorting(core, props)
        filtering = useGridFiltering(core, props)
        return () => h('div')
      },
    })
    const wrapper = mount(Harness, {
      props: {
        defaultMultiSort,
        defaultFilters,
        defaultFilterValues,
        onMultiSortChange,
        onFiltersChange,
        onFilterValuesChange,
      },
    })
    const initialSortingModel = sorting.model
    const initialFilteringModel = filtering.model
    const unsubscribeSorting = core.on(GRID_SORTING_CHANGE_EVENT, sortingEvent)
    const unsubscribeFiltering = core.on(GRID_FILTERING_CHANGE_EVENT, filteringEvent)

    expect(sorting.multiSort.value).toEqual(defaultMultiSort)
    expect(filtering.filters.value).toEqual(defaultFilters)
    expect(filtering.filterValues.value).toEqual(defaultFilterValues)

    await wrapper.setProps({ multiSortState: [], filters: {}, filterValues: {} })
    expect(sorting.multiSort.value).toEqual([])
    expect(filtering.filters.value).toEqual({})
    expect(filtering.filterValues.value).toEqual({})
    expect(sorting.model.get()).toMatchObject({ multiSort: [] })
    expect(filtering.model.get()).toEqual({ filters: {}, filterValues: {} })

    sorting.model.setMultiSort([{ key: 'rejected-multi', direction: 'asc' }])
    filtering.model.setFilters({ rejected: 'filter' })
    filtering.model.setFilterValues({ rejected: ['value'] })
    expect(sorting.multiSort.value).toEqual([])
    expect(filtering.filters.value).toEqual({})
    expect(filtering.filterValues.value).toEqual({})
    const counts = {
      multiSort: onMultiSortChange.mock.calls.length,
      filters: onFiltersChange.mock.calls.length,
      filterValues: onFilterValuesChange.mock.calls.length,
      sortingEvents: sortingEvent.mock.calls.length,
      filteringEvents: filteringEvent.mock.calls.length,
    }

    await wrapper.setProps({ filters: undefined })
    expect(filtering.filters.value).toEqual(defaultFilters)
    expect(filtering.filterValues.value).toEqual({})
    expect(filtering.model.get()).toEqual({
      filters: defaultFilters,
      filterValues: { rejected: ['value'] },
    })

    await wrapper.setProps({ filterValues: undefined, multiSortState: undefined })
    expect(sorting.multiSort.value).toEqual(defaultMultiSort)
    expect(filtering.filters.value).toEqual(defaultFilters)
    expect(filtering.filterValues.value).toEqual(defaultFilterValues)
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
    wrapper.unmount()
  })

  it('treats null as a controlled sort value', async () => {
    const defaultSort: SortState = { key: 'name', direction: 'asc' }
    const proposal: SortState = { key: 'status', direction: 'desc' }
    const onSortChange = vi.fn()
    let sorting!: ReturnType<typeof useGridSorting>
    const Harness = defineComponent({
      props: {
        sort: Object as PropType<SortState | null>,
        defaultSort: Object as PropType<SortState | null>,
        onSortChange: Function as PropType<(sort: SortState | null) => void>,
      },
      setup(props) {
        const core = useGridCore()
        sorting = useGridSorting(core, props)
        return () => h('output', { 'data-testid': 'sort' }, JSON.stringify(sorting.sort.value))
      },
    })

    const wrapper = mount(Harness, { props: { sort: null, defaultSort, onSortChange } })
    expect(sorting.sort.value).toBeNull()
    expect(sorting.model.get().sort).toBeNull()

    sorting.model.setSort(proposal)
    expect(sorting.sort.value).toBeNull()
    expect(sorting.model.get().sort).toEqual(proposal)
    expect(onSortChange).toHaveBeenCalledWith(proposal)

    await wrapper.setProps({ sort: undefined })
    await nextTick()
    expect(sorting.sort.value).toBeNull()
    expect(sorting.model.get().sort).toBeNull()
    expect(wrapper.get('[data-testid="sort"]').text()).toBe('null')
    wrapper.unmount()
  })

  it('cycles an explicitly controlled null sort from null to ascending', () => {
    const onSortChange = vi.fn()
    const sortingEvent = vi.fn()
    let core!: GridCore
    let sorting!: ReturnType<typeof useGridSorting>
    const Harness = defineComponent({
      props: {
        sort: Object as PropType<SortState | null>,
        defaultSort: Object as PropType<SortState | null>,
        onSortChange: Function as PropType<(sort: SortState | null) => void>,
      },
      setup(props) {
        core = useGridCore()
        core.on(GRID_SORTING_CHANGE_EVENT, sortingEvent)
        sorting = useGridSorting(core, props)
        return () => h('output', { 'data-testid': 'sort' }, JSON.stringify(sorting.sort.value))
      },
    })

    const wrapper = mount(Harness, {
      props: {
        sort: null,
        defaultSort: { key: 'name', direction: 'asc' },
        onSortChange,
      },
    })
    expect(sorting.model.get().sort).toBeNull()
    expect(sorting.sort.value).toBeNull()
    expect(onSortChange).not.toHaveBeenCalled()
    expect(sortingEvent).not.toHaveBeenCalled()

    sorting.cycleSort('name')

    expect(sorting.model.get().sort).toEqual({ key: 'name', direction: 'asc' })
    expect(sorting.sort.value).toBeNull()
    expect(onSortChange).toHaveBeenCalledOnce()
    expect(onSortChange).toHaveBeenCalledWith({ key: 'name', direction: 'asc' })
    expect(sortingEvent).toHaveBeenCalledOnce()
    expect(sortingEvent).toHaveBeenCalledWith({
      mode: 'single',
      sort: { key: 'name', direction: 'asc' },
    })
    wrapper.unmount()
  })

  it('rebases rejected controlled sort cycles from the accepted props', () => {
    const acceptedSort: SortState = { key: 'name', direction: 'asc' }
    const acceptedMultiSort: SortState[] = [{ key: 'name', direction: 'asc' }]
    const onSortChange = vi.fn()
    const onMultiSortChange = vi.fn()
    const sortingEvents = vi.fn()
    let sorting!: ReturnType<typeof useGridSorting>

    const Harness = defineComponent({
      props: {
        mode: {
          type: String as PropType<'single' | 'multiple'>,
          default: 'multiple',
        },
        sort: Object as PropType<SortState | null>,
        multiSortState: Array as PropType<SortState[]>,
        onSortChange: Function as PropType<(sort: SortState | null) => void>,
        onMultiSortChange: Function as PropType<(sorts: SortState[]) => void>,
      },
      setup(props) {
        const core = useGridCore()
        core.on(GRID_SORTING_CHANGE_EVENT, sortingEvents)
        sorting = useGridSorting(core, props)
        return () =>
          h('div', [
            h('output', { 'data-testid': 'sort' }, JSON.stringify(sorting.sort.value)),
            h('output', { 'data-testid': 'multi-sort' }, JSON.stringify(sorting.multiSort.value)),
          ])
      },
    })

    const wrapper = mount(Harness, {
      props: {
        sort: acceptedSort,
        multiSortState: acceptedMultiSort,
        onSortChange,
        onMultiSortChange,
      },
    })

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
    expect(sorting.sort.value).toEqual(acceptedSort)
    expect(sorting.multiSort.value).toEqual(acceptedMultiSort)
    expect(wrapper.get('[data-testid="sort"]').text()).toBe(JSON.stringify(acceptedSort))
    expect(wrapper.get('[data-testid="multi-sort"]').text()).toBe(JSON.stringify(acceptedMultiSort))
    wrapper.unmount()
  })

  it('isolates all column snapshots and restores each uncontrolled channel after handoff', async () => {
    let columns: ReturnType<typeof useGridColumns> | undefined
    const Harness = defineComponent({
      props: {
        visibility: Object as PropType<Record<string, boolean>>,
        order: Array as PropType<string[]>,
        widths: Object as PropType<Record<string, number>>,
        pinned: Object as PropType<Record<string, 'left' | 'right' | null>>,
        defaultVisibility: Object as PropType<Record<string, boolean>>,
        defaultOrder: Array as PropType<string[]>,
        defaultWidths: Object as PropType<Record<string, number>>,
        defaultPinned: Object as PropType<Record<string, 'left' | 'right' | null>>,
      },
      setup(props) {
        const core = useGridCore()
        columns = useGridColumns(core, props)
        return () => h('output', JSON.stringify(columns!.state.value))
      },
    })
    const controlled = {
      visibility: { age: false },
      order: ['name'],
      widths: { name: 310 },
      pinned: { name: 'right' as const },
    }
    const wrapper = mount(Harness, {
      props: {
        defaultVisibility: { age: false },
        defaultOrder: ['name', 'age'],
        defaultWidths: { name: 100 },
        defaultPinned: { name: 'left' },
      },
    })

    columns!.setVisibility({ age: true })
    columns!.setOrder(['age', 'name'])
    columns!.setWidths({ name: 116 })
    columns!.setPinned('name', null)
    expect(columns!.model.get()).toMatchObject({
      visibility: { age: true },
      order: ['age', 'name'],
      widths: { name: 116 },
      pinned: { name: null },
    })

    await wrapper.setProps(controlled)
    expect(columns!.model.get()).toMatchObject(controlled)
    columns!.state.value.visibility.age = true
    columns!.state.value.order.push('mutated')
    columns!.state.value.widths.name = 999
    columns!.state.value.pinned.name = 'left'
    expect(columns!.model.get()).toMatchObject(controlled)

    controlled.visibility.age = true
    controlled.order.push('mutated-input')
    controlled.widths.name = 998
    controlled.pinned.name = 'left'
    expect(columns!.model.get()).toMatchObject({
      visibility: { age: false },
      order: ['name'],
      widths: { name: 310 },
      pinned: { name: 'right' },
    })

    await wrapper.setProps({
      visibility: undefined,
      order: undefined,
      widths: undefined,
      pinned: undefined,
    })
    await nextTick()
    expect(columns!.model.get()).toMatchObject({
      visibility: { age: true },
      order: ['age', 'name'],
      widths: { name: 116 },
      pinned: { name: null },
    })
    wrapper.unmount()
  })

  it('isolates virtual snapshots while preserving scroll windows', async () => {
    let core!: GridCore<{ id: string }>
    let virtual!: ReturnType<typeof useGridVirtual>
    const Harness = defineComponent({
      setup() {
        core = useGridCore<{ id: string }>()
        virtual = useGridVirtual(core, {
          items: Array.from({ length: 5 }, (_, index) => ({ id: String(index) })),
          estimateSize: 20,
          viewportSize: 40,
          buffer: 0,
        })
        return () =>
          h(
            'output',
            { 'data-testid': 'virtual-state' },
            JSON.stringify({
              indexes: virtual.state.value.items.map((item) => item.index),
              totalSize: virtual.state.value.totalSize,
            }),
          )
      },
    })

    const wrapper = mount(Harness)
    const model = virtual.model
    const initial = virtual.state.value
    const internal = model.store.getState()
    const expectWindow = (state: typeof initial, indexes: number[], starts: number[]) => {
      expect(state.totalSize).toBe(100)
      expect(state.items.map((item) => item.index)).toEqual(indexes)
      expect(state.items.map((item) => item.start)).toEqual(starts)
      expect(state.items.every((item) => item.size === 20)).toBe(true)
    }

    expect(model).toBe(core.invoke('getVirtualModel'))
    expect(initial).not.toBe(internal)
    expect(initial.items).not.toBe(internal.items)
    expect(initial.items[0]).not.toBe(internal.items[0])
    expectWindow(initial, [0, 1], [0, 20])
    expect(wrapper.get('[data-testid="virtual-state"]').text()).toBe(
      JSON.stringify({ indexes: [0, 1], totalSize: 100 }),
    )

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
    await nextTick()
    expectWindow(virtual.state.value, [1, 2], [20, 40])
    expect(wrapper.get('[data-testid="virtual-state"]').text()).toBe(
      JSON.stringify({ indexes: [1, 2], totalSize: 100 }),
    )

    const emitted = virtual.state.value
    emitted.offsetBefore = 999
    emitted.totalSize = 999
    emitted.items[0]!.start = 999
    emitted.items.length = 0
    expectWindow(model.store.getState(), [1, 2], [20, 40])
    expectWindow(model.getState(), [1, 2], [20, 40])

    model.setScroll(40)
    await nextTick()
    expectWindow(virtual.state.value, [2, 3], [40, 60])
    expect(wrapper.get('[data-testid="virtual-state"]').text()).toBe(
      JSON.stringify({ indexes: [2, 3], totalSize: 100 }),
    )
    wrapper.unmount()
  })

  it('uses one core instance for rows + selection and destroys it with the component', async () => {
    let coreStatus = ''
    const Harness = defineComponent({
      setup() {
        const core = useGridCore<{ id: string }>({})
        const rows = useGridRows(core, [{ id: 'a' }, { id: 'b' }])
        const selection = useGridSelection(core, { defaultValue: ['a'] })
        const virtual = useGridVirtual(core, {
          items: rows.rows.value,
          estimateSize: 20,
          viewportSize: 20,
          getItemKey: (item) => item.id,
        })
        coreStatus = core.status
        return () =>
          h(
            'button',
            { onClick: () => selection.model.toggle('b') },
            `${rows.rows.value.length}:${selection.selection.value.join(',')}:${virtual.state.value.totalSize}`,
          )
      },
    })

    const wrapper = mount(Harness)
    expect(wrapper.text()).toBe('2:a:40')
    await wrapper.trigger('click')
    await nextTick()
    expect(wrapper.text()).toBe('2:a,b:40')
    expect(coreStatus).toBe('created')
    wrapper.unmount()
  })

  it('routes nested row mutations through tree accessors', async () => {
    type TreeRow = { id: number; name: string; children?: TreeRow[] }
    const Harness = defineComponent({
      setup() {
        const core = useGridCore<TreeRow>({})
        const rows = useGridRows(
          core,
          [{ id: 1, name: 'Root', children: [{ id: 2, name: 'Child' }] }],
          { getChildren: (row) => row.children },
        )
        return () =>
          h('div', [
            h('span', { 'data-testid': 'tree-child' }, rows.rows.value[0]?.children?.[0]?.name),
            h(
              'button',
              { onClick: () => rows.model.update(2, { name: 'Updated' }) },
              'update nested',
            ),
            h('button', { onClick: () => rows.model.remove(2) }, 'remove nested'),
          ])
      },
    })

    const wrapper = mount(Harness)
    await wrapper.get('button').trigger('click')
    await nextTick()
    expect(wrapper.get('[data-testid="tree-child"]').text()).toBe('Updated')
    await wrapper.get('button:nth-of-type(2)').trigger('click')
    await nextTick()
    expect(wrapper.get('[data-testid="tree-child"]').text()).toBe('')
    wrapper.unmount()
  })
})
