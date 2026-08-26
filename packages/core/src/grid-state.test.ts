import { describe, expect, it, vi } from 'vitest'
import {
  createGridCore,
  createGridFilteringFeature,
  createGridPaginationFeature,
  GRID_FILTERING_CHANGE_EVENT,
  GRID_PAGINATION_CHANGE_EVENT,
  type GridFilteringChange,
  type GridPaginationChange,
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
})
