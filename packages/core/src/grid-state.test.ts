import { describe, expect, it, vi } from 'vitest'
import {
  createGridCore,
  createGridFilteringFeature,
  createGridPaginationFeature,
  createGridRowsFeature,
  createGridSortingFeature,
  GRID_FILTERING_CHANGE_EVENT,
  GRID_PAGINATION_CHANGE_EVENT,
  GRID_ROWS_CHANGE_EVENT,
  GRID_SORTING_CHANGE_EVENT,
  type GridFilteringChange,
  type GridFilteringModel,
  type GridPaginationChange,
  type GridRowsModel,
  type GridSortingModel,
} from './grid'

describe('createGridFilteringFeature', () => {
  it('composes text/value filter methods, callbacks, and events', () => {
    const onFiltersChange = vi.fn()
    const onFilterValuesChange = vi.fn()
    const events: GridFilteringChange[] = []
    const core = createGridCore({
      features: [createGridFilteringFeature({ onFiltersChange, onFilterValuesChange })],
    })
    core.on<GridFilteringChange>(GRID_FILTERING_CHANGE_EVENT, (event) => events.push(event))
    expect(core.invoke('getFilteringModel')).toBeDefined()

    core.invoke('setFilter', 'name', 'ali')
    core.invoke('setColumnFilterValues', 'status', ['active'])

    expect(core.invoke('getFilters')).toEqual({ name: 'ali' })
    expect(core.invoke('getFilterValues')).toEqual({ status: ['active'] })
    expect(onFiltersChange).toHaveBeenLastCalledWith({ name: 'ali' })
    expect(onFilterValuesChange).toHaveBeenLastCalledWith({ status: ['active'] })
    expect(events).toEqual([
      { channel: 'filters', filters: { name: 'ali' } },
      { channel: 'values', filterValues: { status: ['active'] } },
    ])
  })

  it('clears both channels through one method', () => {
    const core = createGridCore({
      features: [
        createGridFilteringFeature({
          defaultFilters: { name: 'a' },
          defaultFilterValues: { status: ['active'] },
        }),
      ],
    })

    core.invoke('clearAllFilters')

    expect(core.invoke('getFilters')).toEqual({})
    expect(core.invoke('getFilterValues')).toEqual({})
  })

  it('supports silent controlled-state synchronization', () => {
    const onFiltersChange = vi.fn()
    const onFilterValuesChange = vi.fn()
    const event = vi.fn()
    const core = createGridCore({
      features: [createGridFilteringFeature({ onFiltersChange, onFilterValuesChange })],
    })
    core.on(GRID_FILTERING_CHANGE_EVENT, event)

    core.invoke('syncFilters', { name: 'bob' })
    core.invoke('syncFilterValues', { status: ['paused'] })

    expect(core.invoke('getFilters')).toEqual({ name: 'bob' })
    expect(core.invoke('getFilterValues')).toEqual({ status: ['paused'] })
    expect(onFiltersChange).not.toHaveBeenCalled()
    expect(onFilterValuesChange).not.toHaveBeenCalled()
    expect(event).not.toHaveBeenCalled()
  })

  it('does not emit when setters receive equivalent fresh maps', () => {
    const onFiltersChange = vi.fn()
    const onFilterValuesChange = vi.fn()
    const event = vi.fn()
    const core = createGridCore({
      features: [
        createGridFilteringFeature({
          defaultFilters: { name: 'alice' },
          defaultFilterValues: { status: ['active'] },
          onFiltersChange,
          onFilterValuesChange,
        }),
      ],
    })
    core.on(GRID_FILTERING_CHANGE_EVENT, event)
    const stateChange = vi.fn()
    core.invoke('getFilteringModel').store.subscribe(stateChange)

    core.invoke('setFilters', { name: 'alice' })
    core.invoke('setFilterValues', { status: ['active'] })
    core.invoke('clearAllFilters')
    core.invoke('clearAllFilters')

    expect(onFiltersChange).toHaveBeenCalledOnce()
    expect(onFilterValuesChange).toHaveBeenCalledOnce()
    expect(event).toHaveBeenCalledTimes(2)
    expect(stateChange).toHaveBeenCalledOnce()
    expect(core.invoke('getFilters')).toEqual({})
    expect(core.invoke('getFilterValues')).toEqual({})
  })
})

describe('retained Grid feature models', () => {
  it('keeps a retained rows model usable after destroy without callbacks or events', () => {
    type Row = { id: number }
    const onBeforeRowsChange = vi.fn()
    const onRowsChange = vi.fn()
    const event = vi.fn()
    const core = createGridCore<Row>({
      features: [
        createGridRowsFeature<Row>({
          defaultRows: [{ id: 1 }],
          onBeforeRowsChange,
          onRowsChange,
        }),
      ],
    })
    core.on(GRID_ROWS_CHANGE_EVENT, event)
    const model = core.invoke<GridRowsModel<Row>>('getRowsModel')

    expect(model.commit([{ id: 2 }], { reason: 'load' })).toBe(true)
    expect(onBeforeRowsChange).toHaveBeenCalledOnce()
    expect(onRowsChange).toHaveBeenCalledOnce()
    expect(event).toHaveBeenCalledOnce()

    core.destroy()
    core.destroy()
    expect(model.commit([{ id: 3 }])).toBe(true)

    expect(model.get()).toEqual([{ id: 3 }])
    expect(model.getData()).toEqual([{ id: 3 }])
    expect(onBeforeRowsChange).toHaveBeenCalledOnce()
    expect(onRowsChange).toHaveBeenCalledOnce()
    expect(event).toHaveBeenCalledOnce()
  })

  it('keeps retained sorting mutations state-usable without callbacks or events', () => {
    const onSortChange = vi.fn()
    const onMultiSortChange = vi.fn()
    const event = vi.fn()
    const core = createGridCore({
      features: [
        createGridSortingFeature({
          mode: 'multiple',
          onSortChange,
          onMultiSortChange,
        }),
      ],
    })
    core.on(GRID_SORTING_CHANGE_EVENT, event)
    const model = core.invoke<GridSortingModel>('getSortingModel')

    model.setSort({ key: 'name', direction: 'asc' })
    model.setMultiSort([{ key: 'age', direction: 'asc' }])
    expect(onSortChange).toHaveBeenCalledOnce()
    expect(onMultiSortChange).toHaveBeenCalledOnce()
    expect(event).toHaveBeenCalledTimes(2)

    core.destroy()
    model.setSort({ key: 'name', direction: 'desc' })
    model.setMultiSort([{ key: 'age', direction: 'desc' }])
    model.clear()

    expect(model.get()).toEqual({
      sort: { key: 'name', direction: 'desc' },
      multiSort: [],
    })
    expect(onSortChange).toHaveBeenCalledOnce()
    expect(onMultiSortChange).toHaveBeenCalledOnce()
    expect(event).toHaveBeenCalledTimes(2)
  })

  it('keeps retained filtering mutations state-usable without callbacks or events', () => {
    const onFiltersChange = vi.fn()
    const onFilterValuesChange = vi.fn()
    const event = vi.fn()
    const core = createGridCore({
      features: [createGridFilteringFeature({ onFiltersChange, onFilterValuesChange })],
    })
    core.on(GRID_FILTERING_CHANGE_EVENT, event)
    const model = core.invoke<GridFilteringModel>('getFilteringModel')

    model.setFilter('name', 'a')
    model.setColumnFilterValues('status', ['active'])
    expect(onFiltersChange).toHaveBeenCalledOnce()
    expect(onFilterValuesChange).toHaveBeenCalledOnce()
    expect(event).toHaveBeenCalledTimes(2)

    core.destroy()
    model.setFilter('name', 'b')
    model.setColumnFilterValues('status', ['paused'])
    model.clear()

    expect(model.get()).toEqual({ filters: {}, filterValues: {} })
    expect(onFiltersChange).toHaveBeenCalledOnce()
    expect(onFilterValuesChange).toHaveBeenCalledOnce()
    expect(event).toHaveBeenCalledTimes(2)
  })
})

describe('createGridPaginationFeature', () => {
  it('composes page methods, callback, and events as one capability', () => {
    const onChange = vi.fn()
    const events: GridPaginationChange[] = []
    const core = createGridCore({
      features: [createGridPaginationFeature({ defaultPage: 2, defaultPageSize: 20, onChange })],
    })
    core.on<GridPaginationChange>(GRID_PAGINATION_CHANGE_EVENT, (event) => events.push(event))

    core.invoke('setPage', 3)
    core.invoke('setPageSize', 50)

    expect(core.invoke('getPagination')).toEqual({ page: 1, pageSize: 50, total: 0 })
    expect(onChange).toHaveBeenCalledTimes(2)
    expect(events).toEqual([
      { page: 3, pageSize: 20, reason: 'page' },
      { page: 1, pageSize: 50, reason: 'pageSize' },
    ])
  })

  it('silently synchronizes proxy state and derives the page count', () => {
    const onChange = vi.fn()
    const event = vi.fn()
    const core = createGridCore({ features: [createGridPaginationFeature({ onChange })] })
    core.on(GRID_PAGINATION_CHANGE_EVENT, event)

    core.invoke('syncPagination', { page: 4, pageSize: 25, total: 101 })

    expect(core.invoke('getPagination')).toEqual({ page: 4, pageSize: 25, total: 101 })
    expect(core.invoke('getPageCount')).toBe(5)
    expect(onChange).not.toHaveBeenCalled()
    expect(event).not.toHaveBeenCalled()
  })

  it('normalizes invalid public values without coupling to a remote source', () => {
    const core = createGridCore({
      features: [createGridPaginationFeature({ defaultPage: 0, defaultPageSize: -1 })],
    })

    core.invoke('setPagination', 2.9, 5.8)
    core.invoke('syncPagination', { total: -10 })

    expect(core.invoke('getPagination')).toEqual({ page: 2, pageSize: 5, total: 0 })
  })

  it('skips equivalent setter updates across callbacks, events, and store subscribers', () => {
    const onChange = vi.fn()
    const event = vi.fn()
    const core = createGridCore({
      features: [createGridPaginationFeature({ defaultPage: 2, defaultPageSize: 20, onChange })],
    })
    core.on(GRID_PAGINATION_CHANGE_EVENT, event)
    const stateChange = vi.fn()
    core.invoke('getPaginationModel').store.subscribe(stateChange)

    core.invoke('setPage', 2)
    core.invoke('setPagination', 2, 20)

    expect(onChange).not.toHaveBeenCalled()
    expect(event).not.toHaveBeenCalled()
    expect(stateChange).not.toHaveBeenCalled()
  })

  it('keeps a retained model usable after destroy without feature callbacks or events', () => {
    const onChange = vi.fn()
    const event = vi.fn()
    const core = createGridCore({
      features: [createGridPaginationFeature({ defaultPage: 1, onChange })],
    })
    core.on(GRID_PAGINATION_CHANGE_EVENT, event)
    const model = core.invoke('getPaginationModel')

    core.destroy()
    model.setPage(3)

    expect(model.get()).toEqual({ page: 3, pageSize: 10, total: 0 })
    expect(onChange).not.toHaveBeenCalled()
    expect(event).not.toHaveBeenCalled()
  })
})
