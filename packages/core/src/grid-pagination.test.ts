import { describe, expect, it, vi } from 'vitest'
import {
  createGridCore,
  createGridPaginationFeature,
  createGridPaginationProjection,
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

  it('projects rejected controlled proposals and restores channel snapshots silently', () => {
    const onChange = vi.fn()
    const event = vi.fn()
    const core = createGridCore({
      features: [
        createGridPaginationFeature({
          defaultPage: 7,
          defaultPageSize: 20,
          defaultTotal: 100,
          onChange,
        }),
      ],
    })
    core.on(GRID_PAGINATION_CHANGE_EVENT, event)
    const model = core.invoke('getPaginationModel')
    const projection = createGridPaginationProjection(model, { page: 1 })

    projection.sync({ page: 1 })
    model.setPage(2)
    model.setPageSize(30)

    expect(projection.project(model.get(), { page: 1 })).toEqual({
      page: 1,
      pageSize: 30,
      total: 100,
    })
    expect(onChange).toHaveBeenCalledTimes(2)
    expect(event).toHaveBeenCalledTimes(2)

    projection.sync({})
    expect(model.get()).toEqual({ page: 1, pageSize: 30, total: 100 })
    expect(projection.project(model.get(), {})).toEqual(model.get())
    expect(onChange).toHaveBeenCalledTimes(2)
    expect(event).toHaveBeenCalledTimes(2)

    model.setPage(4)
    projection.sync({ page: 2 })
    model.setPage(3)
    expect(projection.project(model.get(), { page: 2 }).page).toBe(2)

    projection.sync({})
    expect(model.get().page).toBe(4)
    expect(projection.project(model.get(), {})).toEqual({
      page: 4,
      pageSize: 30,
      total: 100,
    })
    expect(onChange).toHaveBeenCalledTimes(4)
    expect(event).toHaveBeenCalledTimes(4)

    projection.dispose()
    model.setPage(6)
    projection.sync({ page: 5 })
    model.setPage(7)
    projection.sync({})
    expect(model.get().page).toBe(6)
    expect(onChange).toHaveBeenCalledTimes(6)
    expect(event).toHaveBeenCalledTimes(6)
    projection.dispose()
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
