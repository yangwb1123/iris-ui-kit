import { defineComponent, h, nextTick, type PropType } from 'vue'
import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import {
  GRID_FILTERING_CHANGE_EVENT,
  GRID_SORTING_CHANGE_EVENT,
  type GridCore,
  type GridFilterValues,
  type GridFilteringModel,
  type GridSortingModel,
  type SortState,
} from '@iris-ui-kit/core/grid'
import { useGridColumns, useGridCore, useGridFiltering, useGridSorting } from './index'

describe('Vue Grid vue grid sorting', () => {
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
})
