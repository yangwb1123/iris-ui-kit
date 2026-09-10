import { render } from '@testing-library/svelte'
import { tick } from 'svelte'
import { describe, expect, it, vi } from 'vitest'
import type { Readable } from 'svelte/store'
import type { GridPaginationModel, GridPaginationState } from '@iris-ui-kit/core/grid'
import GridPaginationHarness from './GridPaginationHarness.svelte'

interface PaginationController {
  model: GridPaginationModel
  pagination: Readable<GridPaginationState>
  setPage(page: number): void
  setPageSize(pageSize: number): void
  setPagination(page: number, pageSize: number): void
}

describe('useGridPagination', () => {
  it('hands controlled pagination changes from props into the core model', async () => {
    const view = render(GridPaginationHarness, { page: 1, total: 20 })
    expect(view.getByTestId('page').textContent).toBe('1')

    await view.rerender({ page: 2, total: 20 })

    expect(view.getByTestId('page').textContent).toBe('2')
  })

  it('hides rejected proposals and restores accepted snapshots on handoff', async () => {
    const onChange = vi.fn()
    const onEvent = vi.fn()
    let model!: GridPaginationModel
    const view = render(GridPaginationHarness, {
      page: 1,
      pageSize: 25,
      total: 101,
      onChange,
      onEvent,
      onModel: (value: GridPaginationModel) => (model = value),
    })
    await tick()

    model.setPage(2)
    await tick()
    expect(view.getByTestId('page').textContent).toBe('1')
    expect(onChange).toHaveBeenCalledOnce()
    expect(onEvent).toHaveBeenCalledOnce()

    await view.rerender({
      page: 3,
      pageSize: 25,
      total: 101,
      onChange,
      onEvent,
      onModel: (value: GridPaginationModel) => (model = value),
    })
    await tick()
    expect(model.get().page).toBe(3)
    model.setPage(4)
    await tick()
    expect(view.getByTestId('page').textContent).toBe('3')
    expect(onChange).toHaveBeenCalledTimes(2)
    expect(onEvent).toHaveBeenCalledTimes(2)

    await view.rerender({
      page: undefined,
      pageSize: 25,
      total: 101,
      onChange,
      onEvent,
      onModel: (value: GridPaginationModel) => (model = value),
    })
    await tick()
    expect(view.getByTestId('page').textContent).toBe('3')
    expect(model.get().page).toBe(3)
    expect(onChange).toHaveBeenCalledTimes(2)
    expect(onEvent).toHaveBeenCalledTimes(2)
  })

  it('rebases accepted controlled pagination before the next returned setter', async () => {
    const onChange = vi.fn()
    const onEvent = vi.fn()
    let controller!: PaginationController
    const view = render(GridPaginationHarness, {
      page: 1,
      pageSize: 25,
      total: 101,
      onChange,
      onEvent,
      onPagination: (value: PaginationController) => (controller = value),
    })
    await tick()

    const preWrites: GridPaginationState[] = []
    const originalSetPageSize = controller.model.setPageSize
    const originalSetPage = controller.model.setPage
    vi.spyOn(controller.model, 'setPageSize').mockImplementation((pageSize) => {
      preWrites.push(controller.model.get())
      originalSetPageSize(pageSize)
    })
    vi.spyOn(controller.model, 'setPage').mockImplementation((page) => {
      preWrites.push(controller.model.get())
      originalSetPage(page)
    })

    controller.setPageSize(50)
    expect(preWrites[0]).toEqual({ page: 1, pageSize: 25, total: 101 })
    expect(controller.model.get()).toEqual({ page: 1, pageSize: 50, total: 101 })
    expect(onChange).toHaveBeenNthCalledWith(1, { page: 1, pageSize: 50, reason: 'pageSize' })
    expect(onEvent).toHaveBeenNthCalledWith(1, { page: 1, pageSize: 50, reason: 'pageSize' })
    await tick()
    expect(view.getByTestId('page').textContent).toBe('1')
    expect(view.getByTestId('page-size').textContent).toBe('25')
    expect(view.getByTestId('total').textContent).toBe('101')

    controller.setPage(2)
    expect(preWrites[1]).toEqual({ page: 1, pageSize: 25, total: 101 })
    expect(controller.model.get()).toEqual({ page: 2, pageSize: 25, total: 101 })
    expect(onChange).toHaveBeenNthCalledWith(2, { page: 2, pageSize: 25, reason: 'page' })
    expect(onEvent).toHaveBeenNthCalledWith(2, { page: 2, pageSize: 25, reason: 'page' })
    expect(onChange).toHaveBeenCalledTimes(2)
    expect(onEvent).toHaveBeenCalledTimes(2)
    await tick()
    expect(view.getByTestId('page').textContent).toBe('1')
    expect(view.getByTestId('page-size').textContent).toBe('25')
  })

  it('rebases before setPage, setPageSize, and setPagination without emitting', async () => {
    const onChange = vi.fn()
    const onEvent = vi.fn()
    let controller!: PaginationController
    const view = render(GridPaginationHarness, {
      page: 1,
      pageSize: 25,
      total: 101,
      onChange,
      onEvent,
      onPagination: (value: PaginationController) => (controller = value),
    })
    await tick()

    const preWrites: GridPaginationState[] = []
    let capture = false
    const originalSetPage = controller.model.setPage
    const originalSetPageSize = controller.model.setPageSize
    const originalSet = controller.model.set
    vi.spyOn(controller.model, 'setPage').mockImplementation((page) => {
      if (capture) preWrites.push(controller.model.get())
      originalSetPage(page)
    })
    vi.spyOn(controller.model, 'setPageSize').mockImplementation((pageSize) => {
      if (capture) preWrites.push(controller.model.get())
      originalSetPageSize(pageSize)
    })
    vi.spyOn(controller.model, 'set').mockImplementation((page, pageSize) => {
      if (capture) preWrites.push(controller.model.get())
      originalSet(page, pageSize)
    })

    controller.model.setPageSize(40)
    onChange.mockClear()
    onEvent.mockClear()
    capture = true
    controller.setPage(2)
    capture = false
    expect(preWrites.at(-1)).toEqual({ page: 1, pageSize: 25, total: 101 })
    expect(onChange).toHaveBeenCalledOnce()
    expect(onEvent).toHaveBeenCalledOnce()
    expect(onChange).toHaveBeenCalledWith({ page: 2, pageSize: 25, reason: 'page' })
    expect(onEvent).toHaveBeenCalledWith({ page: 2, pageSize: 25, reason: 'page' })

    controller.model.setPage(3)
    onChange.mockClear()
    onEvent.mockClear()
    capture = true
    controller.setPageSize(50)
    capture = false
    expect(preWrites.at(-1)).toEqual({ page: 1, pageSize: 25, total: 101 })
    expect(onChange).toHaveBeenCalledOnce()
    expect(onEvent).toHaveBeenCalledOnce()
    expect(onChange).toHaveBeenCalledWith({ page: 1, pageSize: 50, reason: 'pageSize' })
    expect(onEvent).toHaveBeenCalledWith({ page: 1, pageSize: 50, reason: 'pageSize' })

    controller.model.setPage(4)
    onChange.mockClear()
    onEvent.mockClear()
    capture = true
    controller.setPagination(2, 50)
    capture = false
    expect(preWrites.at(-1)).toEqual({ page: 1, pageSize: 25, total: 101 })
    expect(onChange).toHaveBeenCalledOnce()
    expect(onEvent).toHaveBeenCalledOnce()
    expect(onChange).toHaveBeenCalledWith({ page: 2, pageSize: 50, reason: 'pagination' })
    expect(onEvent).toHaveBeenCalledWith({ page: 2, pageSize: 50, reason: 'pagination' })
    expect(view.getByTestId('page').textContent).toBe('1')
    expect(view.getByTestId('page-size').textContent).toBe('25')
  })

  it('keeps uncontrolled setter behavior and payloads unchanged', async () => {
    const onChange = vi.fn()
    const onEvent = vi.fn()
    let controller!: PaginationController
    const view = render(GridPaginationHarness, {
      defaultPage: 3,
      defaultPageSize: 25,
      defaultTotal: 101,
      onChange,
      onEvent,
      onPagination: (value: PaginationController) => (controller = value),
    })
    await tick()

    controller.setPage(4)
    controller.setPageSize(50)
    controller.setPagination(2, 10)

    expect(controller.model.get()).toEqual({ page: 2, pageSize: 10, total: 101 })
    expect(onChange.mock.calls).toEqual([
      [{ page: 4, pageSize: 25, reason: 'page' }],
      [{ page: 1, pageSize: 50, reason: 'pageSize' }],
      [{ page: 2, pageSize: 10, reason: 'pagination' }],
    ])
    expect(onEvent.mock.calls).toEqual(onChange.mock.calls)
    await tick()
    expect(view.getByTestId('page').textContent).toBe('2')
    expect(view.getByTestId('page-size').textContent).toBe('10')
  })

  it('rebases controlled channels while preserving an uncontrolled channel', async () => {
    const onChange = vi.fn()
    const onEvent = vi.fn()
    let controller!: PaginationController
    const view = render(GridPaginationHarness, {
      page: 1,
      defaultPageSize: 25,
      total: 101,
      onChange,
      onEvent,
      onPagination: (value: PaginationController) => (controller = value),
    })
    await tick()

    controller.model.setPageSize(40)
    onChange.mockClear()
    onEvent.mockClear()
    const originalSetPage = controller.model.setPage
    let preWrite!: GridPaginationState
    vi.spyOn(controller.model, 'setPage').mockImplementation((page) => {
      preWrite = controller.model.get()
      originalSetPage(page)
    })

    controller.setPage(2)

    expect(preWrite).toEqual({ page: 1, pageSize: 40, total: 101 })
    expect(controller.model.get()).toEqual({ page: 2, pageSize: 40, total: 101 })
    expect(onChange).toHaveBeenCalledOnce()
    expect(onEvent).toHaveBeenCalledOnce()
    expect(onChange).toHaveBeenCalledWith({ page: 2, pageSize: 40, reason: 'page' })
    expect(onEvent).toHaveBeenCalledWith({ page: 2, pageSize: 40, reason: 'page' })
    await tick()
    expect(view.getByTestId('page').textContent).toBe('1')
    expect(view.getByTestId('page-size').textContent).toBe('40')
    expect(view.getByTestId('total').textContent).toBe('101')
  })
})
