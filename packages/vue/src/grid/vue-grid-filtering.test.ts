import { defineComponent, h, nextTick, reactive, type PropType } from 'vue'
import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import {
  GRID_FILTERING_CHANGE_EVENT,
  GRID_SORTING_CHANGE_EVENT,
  type GridCore,
  type GridFilterValues,
  type SortState,
} from '@iris-ui-kit/core/grid'
import { useGridCore, useGridFiltering, useGridSorting } from './index'

describe('Vue Grid vue grid filtering', () => {
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

  it('restores a batched uncontrolled filtering baseline when control enters inside a store batch', async () => {
    const options = reactive({
      filters: undefined as Record<string, string> | undefined,
      filterValues: undefined as GridFilterValues | undefined,
      defaultFilters: {} as Record<string, string>,
      defaultFilterValues: {} as GridFilterValues,
    })
    let core!: GridCore
    let filtering!: ReturnType<typeof useGridFiltering>
    const Harness = defineComponent({
      setup() {
        core = useGridCore()
        filtering = useGridFiltering(core, options)
        return () => h('div')
      },
    })

    const wrapper = mount(Harness)
    filtering.model.setFilters({ status: 'active' })
    filtering.model.setFilterValues({ status: ['active'] })
    await nextTick()
    expect(filtering.model.get().filters).toEqual({ status: 'active' })
    expect(filtering.model.get().filterValues).toEqual({ status: ['active'] })

    filtering.model.store.batch(() => {
      filtering.model.setFilters({ status: 'paused' })
      filtering.model.setFilterValues({ status: ['paused'] })
      options.filters = { status: 'controlled' }
      options.filterValues = { status: ['controlled'] }
    })
    await nextTick()
    expect(filtering.model.get().filters).toEqual({ status: 'controlled' })
    expect(filtering.model.get().filterValues).toEqual({ status: ['controlled'] })

    options.filters = undefined
    options.filterValues = undefined
    await nextTick()

    expect(filtering.model.get().filters).toEqual({ status: 'paused' })
    expect(filtering.model.get().filterValues).toEqual({ status: ['paused'] })
    expect(filtering.filters.value).toEqual(filtering.model.get().filters)
    expect(filtering.filterValues.value).toEqual(filtering.model.get().filterValues)
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
})
