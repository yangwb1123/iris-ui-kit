import { cleanup, fireEvent, render, waitFor } from '@solidjs/testing-library'
import { createSignal } from 'solid-js'
import { describe, expect, it, afterEach, vi } from 'vitest'
import { SortState } from '@iris-ui-kit/core/grid'
import {
  useGridColumns,
  useGridCore,
  useGridFiltering,
  useGridSelection,
  useGridSorting,
} from './index'

afterEach(cleanup)

describe('solid grid defaults', () => {
  it('restores the uncontrolled sort after a rejected controlled handoff', async () => {
    const A: SortState = { key: 'name', direction: 'asc' }
    const B: SortState = { key: 'age', direction: 'desc' }
    const C: SortState = { key: 'status', direction: 'asc' }
    const onSortChange = vi.fn()
    let setControlled!: (value: SortState | undefined) => void
    let sorting!: ReturnType<typeof useGridSorting>

    const Harness = (props: {
      sort?: SortState
      defaultSort: SortState
      onSortChange: (sort: SortState | null) => void
    }) => {
      const core = useGridCore()
      sorting = useGridSorting(core, props)
      return <output data-testid="sort">{JSON.stringify(sorting.sort())}</output>
    }
    const Parent = () => {
      const [sort, updateSort] = createSignal<SortState | undefined>()
      setControlled = updateSort
      return <Harness sort={sort()} defaultSort={A} onSortChange={onSortChange} />
    }

    const view = render(() => <Parent />)
    expect(sorting.sort()).toEqual(A)

    setControlled(B)
    await waitFor(() => {
      expect(sorting.sort()).toEqual(B)
      expect(sorting.model.get().sort).toEqual(B)
    })
    expect(onSortChange).not.toHaveBeenCalled()

    sorting.model.setSort(C)
    expect(sorting.model.get().sort).toEqual(C)
    expect(sorting.sort()).toEqual(B)
    expect(onSortChange).toHaveBeenLastCalledWith(C)
    const proposalCount = onSortChange.mock.calls.length

    setControlled(undefined)
    await waitFor(() => {
      expect(sorting.sort()).toEqual(A)
      expect(sorting.model.get().sort).toEqual(A)
      expect(view.getByTestId('sort').textContent).toBe(JSON.stringify(A))
    })
    expect(onSortChange).toHaveBeenCalledTimes(proposalCount)
    view.unmount()
  })

  it('keeps uncontrolled Grid defaults and model mutations intact', () => {
    const onChange = vi.fn()
    const onSortChange = vi.fn()
    const onMultiSortChange = vi.fn()
    const onFiltersChange = vi.fn()
    const onFilterValuesChange = vi.fn()
    let selection!: ReturnType<typeof useGridSelection>
    let sorting!: ReturnType<typeof useGridSorting>
    let filtering!: ReturnType<typeof useGridFiltering>

    const Harness = () => {
      const core = useGridCore()
      selection = useGridSelection(core, { defaultValue: ['a'], onChange })
      sorting = useGridSorting(core, {
        mode: 'multiple',
        defaultSort: { key: 'name', direction: 'asc' },
        defaultMultiSort: [{ key: 'status', direction: 'asc' }],
        onSortChange,
        onMultiSortChange,
      })
      filtering = useGridFiltering(core, {
        defaultFilters: { name: 'old' },
        defaultFilterValues: { status: ['active'] },
        onFiltersChange,
        onFilterValuesChange,
      })
      return <div />
    }

    const view = render(() => <Harness />)
    expect(selection.model.get()).toEqual(['a'])
    expect(sorting.model.get()).toEqual({
      sort: { key: 'name', direction: 'asc' },
      multiSort: [{ key: 'status', direction: 'asc' }],
    })
    expect(filtering.model.get()).toEqual({
      filters: { name: 'old' },
      filterValues: { status: ['active'] },
    })

    selection.model.toggle('b')
    sorting.model.cycleSort('name')
    sorting.model.cycleMultiSort('status')
    filtering.model.setFilter('status', 'paused')
    filtering.model.setColumnFilterValues('region', ['eu'])

    expect(selection.model.get()).toEqual(['a', 'b'])
    expect(sorting.model.get()).toEqual({
      sort: { key: 'name', direction: 'desc' },
      multiSort: [{ key: 'status', direction: 'desc' }],
    })
    expect(filtering.model.get()).toEqual({
      filters: { name: 'old', status: 'paused' },
      filterValues: { status: ['active'], region: ['eu'] },
    })
    expect(onChange).toHaveBeenCalledWith(['a', 'b'])
    expect(onSortChange).toHaveBeenCalledWith({ key: 'name', direction: 'desc' })
    expect(onMultiSortChange).toHaveBeenCalledWith([{ key: 'status', direction: 'desc' }])
    expect(onFiltersChange).toHaveBeenCalledWith({ name: 'old', status: 'paused' })
    expect(onFilterValuesChange).toHaveBeenCalledWith({ status: ['active'], region: ['eu'] })
    view.unmount()
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
})
