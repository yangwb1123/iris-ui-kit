import { cleanup, render, renderHook, waitFor } from '@solidjs/testing-library'
import { createSignal } from 'solid-js'
import { describe, expect, it, afterEach, vi } from 'vitest'
import {
  GRID_COLUMNS_CHANGE_EVENT,
  GridColumnsChange,
  GridColumnsModel,
  GridCore,
  GridFilterValues,
  GridRowsModel,
  SortState,
} from '@iris-ui-kit/core/grid'
import { useGridColumns, useGridCore, useGridFiltering, useGridRows, useGridSorting } from './index'

afterEach(cleanup)

describe('solid grid columns rows', () => {
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

  it('rejects raw-model proposals on controlled column channels', () => {
    let columns!: ReturnType<typeof useGridColumns>
    const Harness = (props: {
      visibility?: Record<string, boolean>
      order?: string[]
      widths?: Record<string, number>
      pinned?: Record<string, 'left' | 'right' | null>
    }) => {
      const core = useGridCore()
      columns = useGridColumns(core, props)
      return (
        <>
          <output data-testid="visibility">{String(columns.state().visibility.age)}</output>
          <output data-testid="order">{JSON.stringify(columns.state().order)}</output>
          <output data-testid="widths">{String(columns.state().widths.name)}</output>
          <output data-testid="pinned">{String(columns.state().pinned.name)}</output>
        </>
      )
    }
    const Parent = () => {
      const [visibility] = createSignal<Record<string, boolean> | undefined>({ age: false })
      const [order] = createSignal<string[] | undefined>(['name'])
      const [widths] = createSignal<Record<string, number> | undefined>({ name: 100 })
      const [pinned] = createSignal<Record<string, 'left' | 'right' | null> | undefined>({
        name: 'left',
      })
      return (
        <Harness visibility={visibility()} order={order()} widths={widths()} pinned={pinned()} />
      )
    }
    const view = render(() => <Parent />)

    columns.model.setVisibility({ age: true })
    columns.model.setOrder(['age'])
    columns.model.setWidth('name', 310)
    columns.model.setPinned('name', 'right')

    expect(columns.state().visibility.age).toBe(false)
    expect(columns.state().order).toEqual(['name'])
    expect(columns.state().widths).toEqual({ name: 100 })
    expect(columns.state().pinned).toEqual({ name: 'left' })
    // Store itself is rebased (optional, non-sole gate).
    expect(columns.model.get()).toEqual({
      visibility: { age: false },
      order: ['name'],
      widths: { name: 100 },
      pinned: { name: 'left' },
    })

    // Rendered output is rejected synchronously — no waitFor.
    expect(view.getByTestId('visibility').textContent).toBe('false')
    expect(view.getByTestId('order').textContent).toBe('["name"]')
    expect(view.getByTestId('widths').textContent).toBe('100')
    expect(view.getByTestId('pinned').textContent).toBe('left')

    view.unmount()
  })

  it('keeps raw-model writes visible while column channels are uncontrolled', () => {
    let columns!: ReturnType<typeof useGridColumns>
    const Harness = () => {
      const core = useGridCore()
      columns = useGridColumns(core)
      return (
        <>
          <output data-testid="visibility">{String(columns.state().visibility.age)}</output>
          <output data-testid="order">{JSON.stringify(columns.state().order)}</output>
          <output data-testid="widths">{String(columns.state().widths.name)}</output>
          <output data-testid="pinned">{String(columns.state().pinned.name)}</output>
        </>
      )
    }
    const view = render(() => <Harness />)

    columns.model.setVisibility({ age: true })
    columns.model.setOrder(['age'])
    columns.model.setWidth('name', 310)
    columns.model.setPinned('name', 'right')

    expect(columns.state().visibility.age).toBe(true)
    expect(columns.state().order).toEqual(['age'])
    expect(columns.state().widths).toEqual({ name: 310 })
    expect(columns.state().pinned).toEqual({ name: 'right' })
    expect(view.getByTestId('visibility').textContent).toBe('true')
    expect(view.getByTestId('order').textContent).toBe('["age"]')
    expect(view.getByTestId('widths').textContent).toBe('310')
    expect(view.getByTestId('pinned').textContent).toBe('right')

    view.unmount()
  })

  it('preserves proposal callbacks and core events while rejecting controlled writes', () => {
    const onVisibilityChange = vi.fn()
    const onOrderChange = vi.fn()
    const onWidthsChange = vi.fn()
    const onPinnedChange = vi.fn()
    const events: GridColumnsChange[] = []
    let core!: GridCore
    let columns!: ReturnType<typeof useGridColumns>
    const Harness = () => {
      core = useGridCore()
      columns = useGridColumns(core, {
        visibility: { age: false },
        order: ['name'],
        widths: { name: 100 },
        pinned: { name: 'left' },
        onVisibilityChange,
        onOrderChange,
        onWidthsChange,
        onPinnedChange,
      })
      return <div />
    }
    const view = render(() => <Harness />)
    core.on<GridColumnsChange>(GRID_COLUMNS_CHANGE_EVENT, (event) => events.push(event))

    columns.model.setVisibility({ age: true })
    columns.model.toggleVisibility('age')
    columns.model.setOrder(['age'])
    columns.model.setOrder(undefined)
    columns.model.setWidths({ name: 310 })
    columns.model.setWidth('name', 310)
    columns.model.setWidths({})
    columns.model.setPinned('name', 'right')

    expect(onVisibilityChange).toHaveBeenNthCalledWith(1, { age: true })
    expect(onVisibilityChange).toHaveBeenNthCalledWith(2, { age: true })
    expect(onOrderChange).toHaveBeenNthCalledWith(1, ['age'])
    expect(onOrderChange).toHaveBeenNthCalledWith(2, undefined)
    expect(onWidthsChange).toHaveBeenNthCalledWith(1, { name: 310 })
    expect(onWidthsChange).toHaveBeenNthCalledWith(2, { name: 310 })
    expect(onWidthsChange).toHaveBeenNthCalledWith(3, {})
    expect(onPinnedChange).toHaveBeenCalledWith('name', 'right')
    expect(events.map((event) => event.channel)).toEqual([
      'visibility',
      'visibility',
      'order',
      'order',
      'widths',
      'widths',
      'widths',
      'pinned',
    ])
    expect(events[0]).toMatchObject({ channel: 'visibility', visibility: { age: true } })
    expect(events[3]).toMatchObject({ channel: 'order', order: undefined })
    expect(events[6]).toMatchObject({ channel: 'widths', widths: {} })
    expect(events[7]).toMatchObject({ channel: 'pinned', key: 'name', side: 'right' })

    // The store ends at the accepted props even though every proposal notified.
    expect(columns.model.get()).toEqual({
      visibility: { age: false },
      order: ['name'],
      widths: { name: 100 },
      pinned: { name: 'left' },
    })
    view.unmount()
  })

  it('uses replacement tree callbacks without recreating the rows model', async () => {
    type TreeRow = {
      id: number
      name: string
      a?: TreeRow[]
      b?: TreeRow[]
    }
    type TreeOptions = {
      getChildren: (row: TreeRow) => readonly TreeRow[] | undefined
      setChildren: (row: TreeRow, children: TreeRow[]) => TreeRow
    }
    const initialRows: TreeRow[] = [
      {
        id: 1,
        name: 'Root',
        a: [{ id: 2, name: 'A' }],
        b: [{ id: 3, name: 'B' }],
      },
    ]
    const getChildrenA = vi.fn((row: TreeRow) => row.a)
    const getChildrenB = vi.fn((row: TreeRow) => row.b)
    const setChildrenA = vi.fn((row: TreeRow, children: TreeRow[]) => ({ ...row, a: children }))
    const setChildrenB = vi.fn((row: TreeRow, children: TreeRow[]) => ({ ...row, b: children }))
    let setOptions!: (options: TreeOptions) => void
    let bridge!: { model: GridRowsModel<TreeRow> }

    const Harness = (props: TreeOptions) => {
      const core = useGridCore<TreeRow>()
      bridge = useGridRows(core, initialRows, props)
      return <div />
    }
    const Parent = () => {
      const [options, updateOptions] = createSignal<TreeOptions>({
        getChildren: getChildrenA,
        setChildren: setChildrenA,
      })
      setOptions = updateOptions
      return <Harness {...options()} />
    }

    const view = render(() => <Parent />)
    const model = bridge.model
    getChildrenA.mockClear()
    setChildrenA.mockClear()

    setOptions({ getChildren: getChildrenB, setChildren: setChildrenA })
    await waitFor(() => expect(bridge.model).toBe(model))
    expect(model.find(3)).toMatchObject({ id: 3, name: 'B' })
    expect(model.find(2)).toBeUndefined()
    expect(getChildrenA).not.toHaveBeenCalled()
    getChildrenB.mockClear()
    setChildrenA.mockClear()

    setOptions({ getChildren: getChildrenB, setChildren: setChildrenB })
    await waitFor(() => expect(bridge.model).toBe(model))

    expect(model.find(3)).toMatchObject({ id: 3, name: 'B' })
    expect(model.find(2)).toBeUndefined()
    expect(getChildrenA).not.toHaveBeenCalled()

    expect(model.update(3, { name: 'Updated' })).toBe(true)
    expect(model.find(3)).toMatchObject({ id: 3, name: 'Updated' })
    expect(setChildrenB).toHaveBeenCalledOnce()
    expect(setChildrenA).not.toHaveBeenCalled()

    const replacement = [{ id: 4, name: 'Replacement' }]
    expect(model.setChildren(1, replacement)).toBe(true)
    expect(model.get()[0]?.b).toEqual(replacement)
    expect(setChildrenB).toHaveBeenCalledTimes(2)
    expect(setChildrenA).not.toHaveBeenCalled()
    expect(getChildrenA).not.toHaveBeenCalled()
    view.unmount()
  })

  it('keeps sorting and filtering accessors reactive after releasing controlled props', async () => {
    const defaults = {
      sort: { key: 'name', direction: 'asc' } as SortState,
      multiSort: [{ key: 'name', direction: 'asc' }] as SortState[],
      filters: { name: 'Ada' } as Record<string, string>,
      filterValues: { name: ['Ada'] } as GridFilterValues,
    }
    const controlled = {
      sort: { key: 'age', direction: 'desc' } as SortState,
      multiSort: [{ key: 'age', direction: 'desc' }] as SortState[],
      filters: { name: 'Grace' } as Record<string, string>,
      filterValues: { name: ['Grace'] } as GridFilterValues,
    }

    type Props = {
      sort?: SortState
      multiSortState?: SortState[]
      filters?: Record<string, string>
      filterValues?: GridFilterValues
      mode: 'multiple'
      defaultSort: SortState
      defaultMultiSort: SortState[]
      defaultFilters: Record<string, string>
      defaultFilterValues: GridFilterValues
    }

    let setSort!: (v: SortState | undefined) => void
    let setMultiSort!: (v: SortState[] | undefined) => void
    let setFilters!: (v: Record<string, string> | undefined) => void
    let setFilterValues!: (v: GridFilterValues | undefined) => void
    let sorting!: ReturnType<typeof useGridSorting>
    let filtering!: ReturnType<typeof useGridFiltering>

    const Harness = (props: Props) => {
      const core = useGridCore()
      // Pass the reactive props object directly: `{...props}` snapshots values
      // and invalidates the test.
      sorting = useGridSorting(core, props)
      filtering = useGridFiltering(core, props)
      return (
        <div>
          <output data-testid="sort">{JSON.stringify(sorting.sort())}</output>
          <output data-testid="multiSort">{JSON.stringify(sorting.multiSort())}</output>
          <output data-testid="filters">{JSON.stringify(filtering.filters())}</output>
          <output data-testid="filterValues">{JSON.stringify(filtering.filterValues())}</output>
        </div>
      )
    }

    const Parent = () => {
      const [sort, updateSort] = createSignal<SortState | undefined>()
      const [multiSortState, updateMultiSort] = createSignal<SortState[] | undefined>()
      const [filters, updateFilters] = createSignal<Record<string, string> | undefined>()
      const [filterValues, updateFilterValues] = createSignal<GridFilterValues | undefined>()
      setSort = updateSort
      setMultiSort = updateMultiSort
      setFilters = updateFilters
      setFilterValues = updateFilterValues
      return (
        <Harness
          sort={sort()}
          multiSortState={multiSortState()}
          filters={filters()}
          filterValues={filterValues()}
          mode="multiple"
          defaultSort={defaults.sort}
          defaultMultiSort={defaults.multiSort}
          defaultFilters={defaults.filters}
          defaultFilterValues={defaults.filterValues}
        />
      )
    }

    const view = render(() => <Parent />)

    // A. uncontrolled defaults
    await waitFor(() => {
      expect(view.getByTestId('sort').textContent).toBe(JSON.stringify(defaults.sort))
      expect(view.getByTestId('multiSort').textContent).toBe(JSON.stringify(defaults.multiSort))
      expect(view.getByTestId('filters').textContent).toBe(JSON.stringify(defaults.filters))
      expect(view.getByTestId('filterValues').textContent).toBe(
        JSON.stringify(defaults.filterValues),
      )
    })

    // B. controlled (acceptance 3, first half)
    setSort(controlled.sort)
    setMultiSort(controlled.multiSort)
    setFilters(controlled.filters)
    setFilterValues(controlled.filterValues)
    await waitFor(() => {
      expect(view.getByTestId('sort').textContent).toBe(JSON.stringify(controlled.sort))
      expect(view.getByTestId('multiSort').textContent).toBe(JSON.stringify(controlled.multiSort))
      expect(view.getByTestId('filters').textContent).toBe(JSON.stringify(controlled.filters))
      expect(view.getByTestId('filterValues').textContent).toBe(
        JSON.stringify(controlled.filterValues),
      )
    })

    // C. release — DOM must show the restored snapshots (acceptance 3, second half)
    setSort(undefined)
    setMultiSort(undefined)
    setFilters(undefined)
    setFilterValues(undefined)
    await waitFor(() => {
      expect(view.getByTestId('sort').textContent).toBe(JSON.stringify(defaults.sort))
      expect(view.getByTestId('multiSort').textContent).toBe(JSON.stringify(defaults.multiSort))
      expect(view.getByTestId('filters').textContent).toBe(JSON.stringify(defaults.filters))
      expect(view.getByTestId('filterValues').textContent).toBe(
        JSON.stringify(defaults.filterValues),
      )
    })

    // D. uncontrolled mutation after the handoff (acceptance 1 — RED today)
    sorting.model.cycleSort('name') // name asc -> name desc
    sorting.model.setMultiSort([{ key: 'age', direction: 'asc' }])
    filtering.model.setFilters({ name: 'Zoe' })
    filtering.model.setFilterValues({ name: ['Zoe'] })

    // Guard: the core model really moved (the failure is rendering, not state).
    expect(sorting.model.get().sort).toEqual({ key: 'name', direction: 'desc' })
    expect(sorting.model.get().multiSort).toEqual([{ key: 'age', direction: 'asc' }])
    expect(filtering.model.get().filters).toEqual({ name: 'Zoe' })
    expect(filtering.model.get().filterValues).toEqual({ name: ['Zoe'] })

    await waitFor(() => {
      expect(view.getByTestId('sort').textContent).toBe(
        JSON.stringify({ key: 'name', direction: 'desc' }),
      )
      expect(view.getByTestId('multiSort').textContent).toBe(
        JSON.stringify([{ key: 'age', direction: 'asc' }]),
      )
      expect(view.getByTestId('filters').textContent).toBe(JSON.stringify({ name: 'Zoe' }))
      expect(view.getByTestId('filterValues').textContent).toBe(JSON.stringify({ name: ['Zoe'] }))
    })

    view.unmount()
  })
})
