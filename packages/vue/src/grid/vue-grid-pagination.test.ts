import { defineComponent, h, nextTick, type PropType } from 'vue'
import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import {
  GRID_FILTERING_CHANGE_EVENT,
  GRID_PAGINATION_CHANGE_EVENT,
  GRID_ROWS_CHANGE_EVENT,
  GRID_SORTING_CHANGE_EVENT,
  type GridCore,
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
  useGridSorting,
} from './index'

describe('Vue Grid vue grid pagination', () => {
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
})
