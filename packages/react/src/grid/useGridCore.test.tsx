import * as React from 'react'
import { act, fireEvent, render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import {
  createGridFeature,
  GRID_FILTERING_CHANGE_EVENT,
  GRID_PAGINATION_CHANGE_EVENT,
  GRID_ROWS_CHANGE_EVENT,
  GRID_SORTING_CHANGE_EVENT,
  type GridCore,
  type GridFilteringModel,
  type GridRowsModel,
  type GridSortingModel,
} from '@iris-ui-kit/core/grid'
import { useGridCore } from './useGridCore'
import { useGridFeature } from './useGridFeature'
import { useGridExpansion } from './useGridExpansion'
import { useGridFiltering } from './useGridFiltering'
import { useGridPagination } from './useGridPagination'
import { useGridRows } from './useGridRows'
import { useGridSelection } from './useGridSelection'
import { useGridSorting } from './useGridSorting'

/**
 * A single `act(Promise.resolve())` is not always enough for React to run the
 * teardown of an abandoned suspended render: under load the effect flush lands
 * a tick later, and the `dispose` assertion then fails for reasons that have
 * nothing to do with the code under test. Drain microtasks and let React
 * settle instead of assuming one tick.
 *
 * Pass `until` when the caller has an observable post-condition: we keep
 * draining (bounded) until it holds, so a slow machine costs iterations rather
 * than a red test. A fixed number of ticks is a guess; a condition is not.
 */
async function flushTeardown(until?: () => boolean): Promise<void> {
  const maxTurns = 50
  for (let turn = 0; turn < maxTurns; turn += 1) {
    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
    })
    if (!until || until()) return
  }
}

describe('useGridCore', () => {
  it('bridges ready and dispose to the React mount lifecycle', async () => {
    const ready = vi.fn()
    const dispose = vi.fn()
    let core: GridCore | undefined
    const feature = createGridFeature({
      name: 'lifecycle',
      setup: () => ({ onReady: ready, dispose }),
    })
    function Harness() {
      core = useGridCore({ features: [feature] })
      return null
    }

    const view = render(<Harness />)
    expect(core?.status).toBe('ready')
    expect(ready).toHaveBeenCalledOnce()

    view.unmount()
    await flushTeardown()
    expect(core?.status).toBe('destroyed')
    expect(dispose).toHaveBeenCalledOnce()
  })

  it('survives the StrictMode effect replay without destroying the live core', async () => {
    const instances: Array<{
      core: GridCore
      ready: ReturnType<typeof vi.fn>
      dispose: ReturnType<typeof vi.fn>
    }> = []
    const feature = createGridFeature({
      name: 'strict-lifecycle',
      setup: ({ core }) => {
        const ready = vi.fn()
        const dispose = vi.fn()
        instances.push({ core, ready, dispose })
        return { onReady: ready, dispose }
      },
    })
    let liveCore: GridCore | undefined
    function Harness() {
      liveCore = useGridCore({ features: [feature] })
      return null
    }

    const view = render(
      <React.StrictMode>
        <Harness />
      </React.StrictMode>,
    )
    await flushTeardown(() =>
      instances.every(
        (instance) => instance.core === liveCore || instance.core.status === 'destroyed',
      ),
    )
    const live = instances.find((instance) => instance.core === liveCore)
    expect(liveCore?.status).toBe('ready')
    expect(live).toBeDefined()
    expect(live!.ready).toHaveBeenCalledOnce()
    expect(live!.dispose).not.toHaveBeenCalled()
    for (const instance of instances) {
      if (instance.core === liveCore) continue
      expect(instance.core.status).toBe('destroyed')
      expect(instance.dispose).toHaveBeenCalledOnce()
    }

    view.unmount()
    await flushTeardown(() => liveCore?.status === 'destroyed')
    expect(liveCore?.status).toBe('destroyed')
    expect(live!.dispose).toHaveBeenCalledOnce()
  })

  it.each([
    ['core options', 'options'],
    ['render-time feature hook', 'hook'],
  ] as const)('destroys a suspended render abandoned through %s', async (_label, path) => {
    const dispose = vi.fn()
    let capturedCore: GridCore | undefined
    const feature = createGridFeature({
      name: `abandoned-${path}`,
      setup: ({ core }) => {
        capturedCore = core
        return { methods: { probe: () => true }, dispose }
      },
    })
    const suspended = new Promise<void>(() => {})

    function Harness() {
      const core = useGridCore(path === 'options' ? { features: [feature] } : {})
      if (path === 'hook') useGridFeature(core, feature.name, 'probe', () => feature)
      throw suspended
    }

    const view = render(
      <React.Suspense fallback={null}>
        <Harness />
      </React.Suspense>,
    )
    expect(capturedCore?.status).toBe('created')
    expect(capturedCore?.hasFeature(feature.name)).toBe(true)
    expect(capturedCore?.hasMethod('probe')).toBe(true)

    view.unmount()
    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
    })
    await vi.waitFor(() => expect(dispose).toHaveBeenCalledOnce())
    expect(capturedCore?.status).toBe('destroyed')
    expect(capturedCore?.features).toEqual([])
    expect(capturedCore?.methodNames).toEqual([])
    expect(capturedCore?.hasFeature(feature.name)).toBe(false)
    expect(capturedCore?.hasMethod('probe')).toBe(false)
  })
})

describe('useGridPagination', () => {
  it('hides rejected proposals and restores accepted or uncontrolled snapshots on handoff', () => {
    const onChange = vi.fn()
    const paginationEvent = vi.fn()
    let setPage!: React.Dispatch<React.SetStateAction<number | undefined>>
    let pagination!: ReturnType<typeof useGridPagination>
    let core!: GridCore

    function Harness({ page, defaultPage }: { page?: number; defaultPage?: number }) {
      core = useGridCore()
      React.useEffect(() => core.on(GRID_PAGINATION_CHANGE_EVENT, paginationEvent), [core])
      pagination = useGridPagination(core, {
        page,
        defaultPage,
        pageSize: 25,
        total: 101,
        onChange,
      })
      return <output data-testid="pagination">{pagination.pagination.page}</output>
    }

    function ControlledParent() {
      const [page, updatePage] = React.useState<number | undefined>(1)
      setPage = updatePage
      return <Harness page={page} />
    }

    const view = render(<ControlledParent />)
    expect(view.getByTestId('pagination').textContent).toBe('1')

    act(() => pagination.setPage(2))
    expect(view.getByTestId('pagination').textContent).toBe('1')
    expect(onChange).toHaveBeenCalledOnce()
    expect(onChange).toHaveBeenLastCalledWith({ page: 2, pageSize: 25, reason: 'page' })
    expect(paginationEvent).toHaveBeenCalledOnce()
    expect(paginationEvent).toHaveBeenLastCalledWith({
      page: 2,
      pageSize: 25,
      reason: 'page',
    })

    act(() => setPage(1))
    expect(view.getByTestId('pagination').textContent).toBe('1')
    expect(onChange).toHaveBeenCalledOnce()
    expect(paginationEvent).toHaveBeenCalledOnce()

    act(() => setPage(3))
    expect(view.getByTestId('pagination').textContent).toBe('3')
    expect(pagination.model.get().page).toBe(3)
    expect(onChange).toHaveBeenCalledOnce()
    expect(paginationEvent).toHaveBeenCalledOnce()

    act(() => pagination.setPage(4))
    expect(view.getByTestId('pagination').textContent).toBe('3')
    expect(onChange).toHaveBeenCalledTimes(2)
    expect(paginationEvent).toHaveBeenCalledTimes(2)

    act(() => setPage(undefined))
    expect(view.getByTestId('pagination').textContent).toBe('3')
    expect(pagination.model.get().page).toBe(3)
    expect(onChange).toHaveBeenCalledTimes(2)
    expect(paginationEvent).toHaveBeenCalledTimes(2)
    view.unmount()

    onChange.mockClear()
    paginationEvent.mockClear()
    let setDetourPage!: React.Dispatch<React.SetStateAction<number | undefined>>

    function UncontrolledDetourParent() {
      const [page, updatePage] = React.useState<number | undefined>()
      setDetourPage = updatePage
      return <Harness page={page} defaultPage={7} />
    }

    const detourView = render(<UncontrolledDetourParent />)
    expect(detourView.getByTestId('pagination').textContent).toBe('7')
    act(() => setDetourPage(1))
    expect(detourView.getByTestId('pagination').textContent).toBe('1')
    act(() => pagination.setPage(2))
    expect(detourView.getByTestId('pagination').textContent).toBe('1')
    act(() => setDetourPage(undefined))
    expect(detourView.getByTestId('pagination').textContent).toBe('7')
    expect(pagination.model.get().page).toBe(7)
    expect(onChange).toHaveBeenCalledOnce()
    expect(paginationEvent).toHaveBeenCalledOnce()
    detourView.unmount()
  })

  it('bridges controlled proxy state and resets the page when pageSize changes', () => {
    const onChange = vi.fn()
    function Harness({ page, pageSize }: { page: number; pageSize: number }) {
      const core = useGridCore()
      const pagination = useGridPagination(core, { page, pageSize, total: 101, onChange })
      return (
        <button type="button" onClick={() => pagination.setPageSize(50)}>
          {pagination.pagination.page}/{pagination.pagination.pageSize}/
          {pagination.pagination.total}
        </button>
      )
    }

    const view = render(<Harness page={3} pageSize={25} />)
    fireEvent.click(view.getByRole('button'))

    expect(view.getByRole('button').textContent).toBe('3/25/101')
    expect(onChange).toHaveBeenLastCalledWith({ page: 1, pageSize: 50, reason: 'pageSize' })
    view.unmount()
  })
})

describe('Grid feature teardown', () => {
  it('keeps retained feature models usable after the React owner unmounts', async () => {
    type Row = { id: number; name: string; status: string }
    const onBeforeRowsChange = vi.fn()
    const onRowsChange = vi.fn()
    const onSortChange = vi.fn()
    const onMultiSortChange = vi.fn()
    const onFiltersChange = vi.fn()
    const onFilterValuesChange = vi.fn()
    const rowEvent = vi.fn()
    const sortingEvent = vi.fn()
    const filteringEvent = vi.fn()
    let rowsModel: GridRowsModel<Row> | undefined
    let sortingModel: GridSortingModel | undefined
    let filteringModel: GridFilteringModel | undefined

    function Harness() {
      const core = useGridCore<Row>()
      const rows = useGridRows(core, [{ id: 1, name: 'Ada', status: 'active' }], {
        onBeforeRowsChange,
        onRowsChange,
      })
      const sorting = useGridSorting(core, rows.rows, {
        leafColumns: [
          { key: 'name', sortable: true },
          { key: 'status', sortable: true },
        ],
        multiSort: true,
        onSortChange,
        onMultiSortChange,
      })
      const filtering = useGridFiltering(core, rows.rows, {
        columns: [{ key: 'name' }, { key: 'status' }],
        getValue: (row, column) => row[column.key as keyof Row],
        onFiltersChange,
        onFilterValuesChange,
      })
      rowsModel = rows.model
      sortingModel = sorting.model
      filteringModel = filtering.model

      React.useEffect(() => {
        core.on(GRID_ROWS_CHANGE_EVENT, rowEvent)
        core.on(GRID_SORTING_CHANGE_EVENT, sortingEvent)
        core.on(GRID_FILTERING_CHANGE_EVENT, filteringEvent)
      }, [core])
      return null
    }

    const view = render(<Harness />)
    await flushTeardown()
    act(() => {
      rowsModel!.commit([{ id: 2, name: 'Bea', status: 'paused' }])
      sortingModel!.setSort({ key: 'name', direction: 'asc' })
      sortingModel!.setMultiSort([{ key: 'status', direction: 'asc' }])
      filteringModel!.setFilter('name', 'a')
      filteringModel!.setColumnFilterValues('status', ['active'])
    })

    expect(onBeforeRowsChange).toHaveBeenCalledOnce()
    expect(onRowsChange).toHaveBeenCalledOnce()
    expect(onSortChange).toHaveBeenCalledOnce()
    expect(onMultiSortChange).toHaveBeenCalledOnce()
    expect(onFiltersChange).toHaveBeenCalledOnce()
    expect(onFilterValuesChange).toHaveBeenCalledOnce()
    expect(rowEvent).toHaveBeenCalledOnce()
    expect(sortingEvent).toHaveBeenCalledTimes(2)
    expect(filteringEvent).toHaveBeenCalledTimes(2)

    view.unmount()
    await flushTeardown()
    act(() => {
      rowsModel!.commit([{ id: 3, name: 'Cora', status: 'active' }])
      sortingModel!.setSort({ key: 'name', direction: 'desc' })
      sortingModel!.setMultiSort([{ key: 'status', direction: 'desc' }])
      filteringModel!.setFilter('name', 'b')
      filteringModel!.setColumnFilterValues('status', ['paused'])
      filteringModel!.clear()
    })

    expect(rowsModel!.getData()).toEqual([{ id: 3, name: 'Cora', status: 'active' }])
    expect(sortingModel!.get()).toEqual({
      sort: { key: 'name', direction: 'desc' },
      multiSort: [{ key: 'status', direction: 'desc' }],
    })
    expect(filteringModel!.get()).toEqual({ filters: {}, filterValues: {} })
    expect(onBeforeRowsChange).toHaveBeenCalledOnce()
    expect(onRowsChange).toHaveBeenCalledOnce()
    expect(onSortChange).toHaveBeenCalledOnce()
    expect(onMultiSortChange).toHaveBeenCalledOnce()
    expect(onFiltersChange).toHaveBeenCalledOnce()
    expect(onFilterValuesChange).toHaveBeenCalledOnce()
    expect(rowEvent).toHaveBeenCalledOnce()
    expect(sortingEvent).toHaveBeenCalledTimes(2)
    expect(filteringEvent).toHaveBeenCalledTimes(2)
  })
})

describe('composed Grid features', () => {
  it('loads rows, selection, expansion, sorting, filtering, and pagination into one core', () => {
    const onExpand = vi.fn()
    let seenCore: GridCore | undefined
    function Harness() {
      const core = useGridCore()
      seenCore = core
      const rows = useGridRows(core, [{ name: 'b' }, { name: 'a' }])
      const selection = useGridSelection(core, { defaultValue: ['selected'] })
      const expansion = useGridExpansion(core, { defaultValue: ['open'], onChange: onExpand })
      const sorting = useGridSorting(core, rows.rows, {
        leafColumns: [{ key: 'name', sortable: true }],
        defaultSort: { key: 'name', direction: 'asc' },
      })
      const filtering = useGridFiltering(core, sorting.sortedData, {
        columns: [{ key: 'name' }],
        getValue: (row, column) => row[column.key],
        defaultFilters: { name: 'a' },
      })
      const pagination = useGridPagination(core, { defaultPageSize: 25, defaultTotal: 51 })
      return (
        <button
          type="button"
          onClick={() => {
            expansion.model.toggle('next')
            pagination.setPage(2)
          }}
        >
          {selection.selection.join(',')}|{expansion.expandedKeys.join(',')}|
          {filtering.filteredData.map((row) => row.name).join(',')}|{pagination.pagination.page}
        </button>
      )
    }

    const view = render(<Harness />)
    expect(seenCore?.features).toEqual([
      'rows',
      'selection',
      'expansion',
      'sorting',
      'filtering',
      'pagination',
    ])
    fireEvent.click(view.getByRole('button'))

    expect(view.getByRole('button').textContent).toBe('selected|open,next|a|2')
    expect(onExpand).toHaveBeenLastCalledWith(['open', 'next'])
    view.unmount()
  })
})
