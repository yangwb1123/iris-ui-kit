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

  it('normalizes unsafe values and keeps invalid or equivalent size changes no-op', () => {
    const onChange = vi.fn()
    const core = createGridCore({
      features: [
        createGridPaginationFeature({
          defaultPage: Number.MAX_VALUE,
          defaultPageSize: 10,
          defaultTotal: 25,
          onChange,
        }),
      ],
    })
    const model = core.invoke('getPaginationModel')
    const stateChange = vi.fn()
    model.store.subscribe(stateChange)

    expect(model.get()).toEqual({ page: 1, pageSize: 10, total: 25 })
    model.setPage(Number.MAX_VALUE)
    expect(model.get().page).toBe(1)
    expect(onChange).not.toHaveBeenCalled()
    expect(stateChange).not.toHaveBeenCalled()

    model.setPage(3)
    onChange.mockClear()
    stateChange.mockClear()
    model.setPageSize(Number.NaN)
    expect(model.get()).toEqual({ page: 3, pageSize: 10, total: 25 })
    expect(onChange).not.toHaveBeenCalled()
    expect(stateChange).not.toHaveBeenCalled()

    model.sync({ total: 0 })
    expect(model.get()).toEqual({ page: 3, pageSize: 10, total: 0 })
    expect(onChange).not.toHaveBeenCalled()
    expect(stateChange).toHaveBeenCalledOnce()
  })
})
