import { cleanup, render, waitFor } from '@solidjs/testing-library'
import { createSignal } from 'solid-js'
import { describe, expect, it, afterEach, vi } from 'vitest'
import { GRID_PAGINATION_CHANGE_EVENT } from '@iris-ui-kit/core/grid'
import { useGridCore, useGridPagination } from './index'

afterEach(cleanup)

describe('solid grid pagination', () => {
  it('hands controlled pagination changes from props into the core model', () => {
    let setPage!: (page: number) => void
    const Harness = (props: { page: number; total: number }) => {
      const core = useGridCore()
      const pagination = useGridPagination(core, props)
      return <output data-testid="page">{pagination.pagination().page}</output>
    }
    const Parent = () => {
      const [page, updatePage] = createSignal(1)
      setPage = updatePage
      return <Harness page={page()} total={20} />
    }

    const view = render(() => <Parent />)
    expect(view.getByTestId('page').textContent).toBe('1')
    setPage(2)
    expect(view.getByTestId('page').textContent).toBe('2')
  })

  it('hides rejected pagination proposals and restores accepted snapshots on handoff', async () => {
    type Props = {
      page?: number
      defaultPage?: number
      pageSize?: number
      total?: number
      onChange: (change: unknown) => void
    }
    const onChange = vi.fn()
    const paginationEvent = vi.fn()
    let setPage!: (page: number | undefined) => void
    let pagination!: ReturnType<typeof useGridPagination>

    const Harness = (props: Props) => {
      const core = useGridCore()
      core.on(GRID_PAGINATION_CHANGE_EVENT, paginationEvent)
      pagination = useGridPagination(core, props)
      return <output data-testid="page">{pagination.pagination().page}</output>
    }
    const Parent = () => {
      const [page, updatePage] = createSignal<number | undefined>(1)
      setPage = updatePage
      return <Harness page={page()} pageSize={25} total={101} onChange={onChange} />
    }

    const view = render(() => <Parent />)
    expect(view.getByTestId('page').textContent).toBe('1')

    pagination.model.setPage(2)
    await waitFor(() => expect(view.getByTestId('page').textContent).toBe('1'))
    expect(onChange).toHaveBeenCalledOnce()
    expect(paginationEvent).toHaveBeenCalledOnce()

    setPage(3)
    await waitFor(() => expect(view.getByTestId('page').textContent).toBe('3'))
    pagination.model.setPage(4)
    await waitFor(() => expect(view.getByTestId('page').textContent).toBe('3'))
    expect(onChange).toHaveBeenCalledTimes(2)
    expect(paginationEvent).toHaveBeenCalledTimes(2)

    setPage(undefined)
    await waitFor(() => {
      expect(view.getByTestId('page').textContent).toBe('3')
      expect(pagination.model.get().page).toBe(3)
    })
    expect(onChange).toHaveBeenCalledTimes(2)
    expect(paginationEvent).toHaveBeenCalledTimes(2)
  })

  it('captures a batched uncontrolled write when props take control inside the same core batch', () => {
    type Props = {
      page?: number
      pageSize?: number
      total?: number
      onChange: (change: unknown) => void
    }
    const onChange = vi.fn()
    let setPageProp!: (page: number | undefined) => void
    let pagination!: ReturnType<typeof useGridPagination>

    const Harness = (props: Props) => {
      const core = useGridCore()
      pagination = useGridPagination(core, props)
      return <output data-testid="page">{pagination.pagination().page}</output>
    }
    const Parent = () => {
      const [page, updatePage] = createSignal<number | undefined>(undefined)
      setPageProp = updatePage
      return <Harness page={page()} pageSize={25} total={101} onChange={onChange} />
    }

    const view = render(() => <Parent />)
    expect(view.getByTestId('page').textContent).toBe('1')

    // Uncontrolled write first; prop-driven control entry flushes the Solid
    // `createEffect` synchronously — still inside the open core batch.
    pagination.model.store.batch(() => {
      pagination.model.setPage(5)
      setPageProp(3)
    })

    // While controlled, the accepted prop wins and the model is rebased.
    expect(pagination.model.get().page).toBe(3)
    expect(pagination.pagination().page).toBe(3)
    expect(view.getByTestId('page').textContent).toBe('3')
    expect(onChange).toHaveBeenCalledOnce()
    expect(onChange).toHaveBeenCalledWith({ page: 5, pageSize: 25, reason: 'page' })

    // Releasing control restores the batched uncontrolled write, not the stale pre-batch snapshot.
    setPageProp(undefined)

    expect(pagination.model.get().page).toBe(5)
    expect(pagination.pagination().page).toBe(5)
    expect(view.getByTestId('page').textContent).toBe('5')
    expect(onChange).toHaveBeenCalledOnce()
  })

  it('captures a batched uncontrolled pageSize write when props take control inside the same core batch', () => {
    type Props = {
      page?: number
      pageSize?: number
      total?: number
      onChange: (change: unknown) => void
    }
    const onChange = vi.fn()
    let setPageSizeProp!: (pageSize: number | undefined) => void
    let pagination!: ReturnType<typeof useGridPagination>

    const Harness = (props: Props) => {
      const core = useGridCore()
      pagination = useGridPagination(core, props)
      return <output data-testid="pageSize">{pagination.pagination().pageSize}</output>
    }
    const Parent = () => {
      const [pageSize, updatePageSize] = createSignal<number | undefined>(undefined)
      setPageSizeProp = updatePageSize
      return <Harness page={1} pageSize={pageSize()} total={101} onChange={onChange} />
    }

    const view = render(() => <Parent />)
    expect(view.getByTestId('pageSize').textContent).toBe('10')

    pagination.model.store.batch(() => {
      pagination.model.setPageSize(50)
      setPageSizeProp(2)
    })

    expect(pagination.model.get().pageSize).toBe(2)
    expect(pagination.pagination().pageSize).toBe(2)

    setPageSizeProp(undefined)

    expect(pagination.model.get().pageSize).toBe(50)
    expect(pagination.pagination().pageSize).toBe(50)
    expect(view.getByTestId('pageSize').textContent).toBe('50')
  })

  it('does not capture a batched model write for a channel that is already controlled', () => {
    type Props = {
      page?: number
      onChange: (change: unknown) => void
    }
    const onChange = vi.fn()
    let setPageProp!: (page: number | undefined) => void
    let pagination!: ReturnType<typeof useGridPagination>

    const Harness = (props: Props) => {
      const core = useGridCore()
      pagination = useGridPagination(core, props)
      return <output data-testid="page">{pagination.pagination().page}</output>
    }
    const Parent = () => {
      const [page, updatePage] = createSignal<number | undefined>(3)
      setPageProp = updatePage
      return <Harness page={page()} onChange={onChange} />
    }

    const view = render(() => <Parent />)
    expect(view.getByTestId('page').textContent).toBe('3')

    pagination.model.store.batch(() => {
      pagination.model.setPage(5) // rejected proposal: page is already controlled
      setPageProp(4) // last accepted prop
    })

    expect(pagination.model.get().page).toBe(4)

    setPageProp(undefined)

    // Restores the last accepted controlled snapshot (4), never the rejected write (5).
    expect(pagination.model.get().page).toBe(4)
    expect(pagination.pagination().page).toBe(4)
  })
})
