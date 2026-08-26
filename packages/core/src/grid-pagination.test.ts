import { describe, expect, it, vi } from 'vitest'
import {
  createGridCore,
  createGridPaginationFeature,
  GRID_PAGINATION_CHANGE_EVENT,
  type GridPaginationChange,
} from './grid'

describe('createGridPaginationFeature', () => {
  it('isolates callback mutation from the event payload', () => {
    const callbackSnapshots: GridPaginationChange[] = []
    const onChange = vi.fn((change: GridPaginationChange) => {
      callbackSnapshots.push({ ...change })
      const mutable = change as unknown as { page: number }
      mutable.page = 99
    })
    const event = vi.fn()
    const core = createGridCore({ features: [createGridPaginationFeature({ onChange })] })
    core.on<GridPaginationChange>(GRID_PAGINATION_CHANGE_EVENT, event)

    core.invoke('setPage', 3)

    expect(callbackSnapshots).toEqual([{ page: 3, pageSize: 10, reason: 'page' }])
    expect(event).toHaveBeenCalledWith({ page: 3, pageSize: 10, reason: 'page' })
    expect(onChange.mock.calls[0]?.[0]).not.toBe(event.mock.calls[0]?.[0])
  })

  it('isolates event mutation from the internal pagination state', () => {
    const onChange = vi.fn()
    const event = vi.fn((change: GridPaginationChange) => {
      const mutable = change as unknown as { page: number; reason: GridPaginationChange['reason'] }
      mutable.page = 99
      mutable.reason = 'pageSize'
    })
    const core = createGridCore({
      features: [createGridPaginationFeature({ defaultPage: 2, defaultPageSize: 20, onChange })],
    })
    core.on<GridPaginationChange>(GRID_PAGINATION_CHANGE_EVENT, event)

    core.invoke('setPage', 3)

    expect(onChange).toHaveBeenCalledWith({ page: 3, pageSize: 20, reason: 'page' })
    expect(core.invoke('getPagination')).toEqual({ page: 3, pageSize: 20, total: 0 })
  })
})
