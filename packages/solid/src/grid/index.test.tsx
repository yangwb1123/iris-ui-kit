import { cleanup, fireEvent, render, renderHook, waitFor } from '@solidjs/testing-library'
import { createSignal } from 'solid-js'
import { describe, expect, it, afterEach, vi } from 'vitest'
import {
  GRID_COLUMNS_CHANGE_EVENT,
  type GridColumnsChange,
  type GridColumnsModel,
  type GridCore,
} from '@iris-ui-kit/core/grid'
import {
  useGridColumns,
  useGridCore,
  useGridPagination,
  useGridRows,
  useGridSelection,
  useGridVirtual,
} from './index'

afterEach(cleanup)

describe('Solid Grid Core bridge', () => {
  it('uses one core instance for rows + selection through Solid signals', () => {
    const { result } = renderHook(() => {
      const core = useGridCore<{ id: string }>()
      const rows = useGridRows(core, [{ id: 'a' }, { id: 'b' }])
      const selection = useGridSelection<{ id: string }, string>(core, { defaultValue: ['a'] })
      const virtual = useGridVirtual(core, {
        items: rows.rows(),
        estimateSize: 20,
        viewportSize: 20,
        getItemKey: (item) => item.id,
      })
      return { core, rows, selection, virtual }
    })

    expect(result.core.status).toBe('ready')
    expect(result.rows.rows()).toHaveLength(2)
    expect(result.selection.selection()).toEqual(['a'])
    expect(result.virtual.state().totalSize).toBe(40)
    result.selection.model.toggle('b')
    expect(result.selection.selection()).toEqual(['a', 'b'])
  })

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

  it('restores the uncontrolled visibility snapshot across rejected control handoff', async () => {
    let setVisibility!: (value: Record<string, boolean> | undefined) => void
    let toggleVisibility!: () => void
    const Harness = (props: {
      visibility?: Record<string, boolean>
      defaultVisibility: Record<string, boolean>
    }) => {
      const core = useGridCore()
      const columns = useGridColumns(core, props)
      toggleVisibility = () => columns.toggleVisibility('age')
      return <output data-testid="visibility">{String(columns.state().visibility.age)}</output>
    }
    const Parent = () => {
      const [visibility, updateVisibility] = createSignal<Record<string, boolean> | undefined>({
        age: false,
      })
      setVisibility = updateVisibility
      return <Harness visibility={visibility()} defaultVisibility={{ age: false }} />
    }

    const view = render(() => <Parent />)
    expect(view.getByTestId('visibility').textContent).toBe('false')

    toggleVisibility()
    await waitFor(() => expect(view.getByTestId('visibility').textContent).toBe('false'))

    setVisibility(undefined)
    await waitFor(() => expect(view.getByTestId('visibility').textContent).toBe('false'))

    setVisibility({ age: true })
    await waitFor(() => expect(view.getByTestId('visibility').textContent).toBe('true'))
    setVisibility(undefined)
    await waitFor(() => expect(view.getByTestId('visibility').textContent).toBe('false'))
    view.unmount()
  })

  it('isolates all column snapshots and restores each uncontrolled channel after handoff', async () => {
    let columns!: ReturnType<typeof useGridColumns>
    let setVisibility!: (value: Record<string, boolean> | undefined) => void
    let setOrder!: (value: string[] | undefined) => void
    let setWidths!: (value: Record<string, number> | undefined) => void
    let setPinned!: (value: Record<string, 'left' | 'right' | null> | undefined) => void
    const Harness = (props: {
      visibility?: Record<string, boolean>
      order?: string[]
      widths?: Record<string, number>
      pinned?: Record<string, 'left' | 'right' | null>
      defaultVisibility: Record<string, boolean>
      defaultOrder: string[]
      defaultWidths: Record<string, number>
      defaultPinned: Record<string, 'left' | 'right' | null>
    }) => {
      const core = useGridCore()
      columns = useGridColumns(core, props)
      return (
        <>
          <output data-testid="state">{JSON.stringify(columns.state())}</output>
          <button
            type="button"
            onClick={() => {
              columns.setVisibility({ age: true })
              columns.setOrder(['age', 'name'])
              columns.setWidths({ name: 116 })
              columns.setPinned('name', null)
            }}
          >
            edit
          </button>
        </>
      )
    }
    const Parent = () => {
      const [visibility, updateVisibility] = createSignal<Record<string, boolean> | undefined>()
      const [order, updateOrder] = createSignal<string[] | undefined>()
      const [widths, updateWidths] = createSignal<Record<string, number> | undefined>()
      const [pinned, updatePinned] = createSignal<
        Record<string, 'left' | 'right' | null> | undefined
      >()
      setVisibility = updateVisibility
      setOrder = updateOrder
      setWidths = updateWidths
      setPinned = updatePinned
      return (
        <Harness
          visibility={visibility()}
          order={order()}
          widths={widths()}
          pinned={pinned()}
          defaultVisibility={{ age: false }}
          defaultOrder={['name', 'age']}
          defaultWidths={{ name: 100 }}
          defaultPinned={{ name: 'left' }}
        />
      )
    }
    const view = render(() => <Parent />)
    fireEvent.click(view.getByRole('button', { name: 'edit' }))
    expect(columns.model.get()).toMatchObject({
      visibility: { age: true },
      order: ['age', 'name'],
      widths: { name: 116 },
      pinned: { name: null },
    })

    const controlled = {
      visibility: { age: false },
      order: ['name'],
      widths: { name: 310 },
      pinned: { name: 'right' as 'left' | 'right' | null },
    }
    setVisibility(controlled.visibility)
    setOrder(controlled.order)
    setWidths(controlled.widths)
    setPinned(controlled.pinned)
    await waitFor(() => expect(columns.model.get()).toMatchObject(controlled))

    const snapshot = columns.state()
    snapshot.visibility.age = true
    snapshot.order.push('mutated')
    snapshot.widths.name = 999
    snapshot.pinned.name = 'left'
    expect(columns.model.get()).toMatchObject(controlled)

    controlled.visibility.age = true
    controlled.order.push('mutated-input')
    controlled.widths.name = 998
    controlled.pinned.name = 'left'
    expect(columns.model.get()).toMatchObject({
      visibility: { age: false },
      order: ['name'],
      widths: { name: 310 },
      pinned: { name: 'right' },
    })

    setVisibility(undefined)
    setOrder(undefined)
    setWidths(undefined)
    setPinned(undefined)
    await waitFor(() =>
      expect(columns.model.get()).toMatchObject({
        visibility: { age: true },
        order: ['age', 'name'],
        widths: { name: 116 },
        pinned: { name: null },
      }),
    )
    view.unmount()
  })

  it('routes nested row mutations through tree accessors', () => {
    type TreeRow = { id: number; name: string; children?: TreeRow[] }
    const { result } = renderHook(() => {
      const core = useGridCore<TreeRow>()
      const rows = useGridRows(
        core,
        [{ id: 1, name: 'Root', children: [{ id: 2, name: 'Child' }] }],
        { getChildren: (row) => row.children },
      )
      return rows
    })

    expect(result.rows()[0]?.children?.[0]?.name).toBe('Child')
    expect(result.model.update(2, { name: 'Updated' })).toBe(true)
    expect(result.rows()[0]?.children?.[0]?.name).toBe('Updated')
    expect(result.model.remove(2)).toBe(true)
    expect(result.rows()[0]?.children).toEqual([])
  })

  it('installs one columns model, keeps inbound sync silent, and routes writes', () => {
    let core: GridCore<{ id: string }> | undefined
    let columns: ReturnType<typeof useGridColumns> | undefined
    const onVisibilityChange = vi.fn()
    const onWidthsChange = vi.fn()
    const events: GridColumnsChange[] = []

    const Harness = () => {
      core = useGridCore<{ id: string }>()
      columns = useGridColumns(core, { onVisibilityChange, onWidthsChange })
      return <div />
    }

    const view = render(() => <Harness />)
    const feature = columns!
    core!.on<GridColumnsChange>(GRID_COLUMNS_CHANGE_EVENT, (event) => events.push(event))
    expect(core!.features.filter((name) => name === 'columns')).toHaveLength(1)
    expect(feature.model).toBe(core!.invoke<GridColumnsModel>('getColumnsModel'))

    feature.model.syncVisibility({ hidden: false })
    feature.model.syncWidths({ name: 120 })
    expect(onVisibilityChange).not.toHaveBeenCalled()
    expect(onWidthsChange).not.toHaveBeenCalled()
    expect(events).toEqual([])

    feature.setVisibility({ hidden: true })
    feature.setWidths({ name: 140 })
    expect(onVisibilityChange).toHaveBeenCalledWith({ hidden: true })
    expect(onWidthsChange).toHaveBeenCalledWith({ name: 140 })

    feature.resetWidths()
    expect(onWidthsChange).toHaveBeenLastCalledWith({})
    view.unmount()
    expect(core!.status).toBe('destroyed')
  })
})
