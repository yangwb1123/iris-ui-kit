import * as React from 'react'
import { act, fireEvent, render } from '@testing-library/react'
import type { Store } from '@iris-ui-kit/core'
import { describe, expect, it, vi } from 'vitest'
import {
  GRID_SELECTION_CHANGE_EVENT,
  GRID_SORTING_CHANGE_EVENT,
  type GridCore,
  type SortState,
} from '@iris-ui-kit/core/grid'
import { useGridCore } from './useGridCore'
import { useGridExpansion } from './useGridExpansion'
import { useGridSelection } from './useGridSelection'
import { useGridSorting } from './useGridSorting'

describe('useGridSelection', () => {
  it('bridges an uncontrolled selection feature without duplicating its state', () => {
    const onChange = vi.fn()
    function Harness() {
      const core = useGridCore()
      const selection = useGridSelection(core, { defaultValue: ['a'], onChange })
      return (
        <button type="button" onClick={() => selection.model.toggle('b')}>
          {selection.selection.join(',')}
        </button>
      )
    }

    const view = render(<Harness />)
    fireEvent.click(view.getByRole('button'))

    expect(view.getByRole('button').textContent).toBe('a,b')
    expect(onChange).toHaveBeenLastCalledWith(['a', 'b'])
    view.unmount()
  })

  it('renders controlled state and rebases mutations on the latest prop', () => {
    const onChange = vi.fn()
    function Harness({ value }: { value: string[] }) {
      const core = useGridCore()
      const selection = useGridSelection(core, { value, onChange })
      return (
        <button
          type="button"
          onClick={() => {
            selection.rebase()
            selection.model.toggle('b')
          }}
        >
          {selection.selection.join(',')}
        </button>
      )
    }

    const view = render(<Harness value={['a']} />)
    view.rerender(<Harness value={['c']} />)
    fireEvent.click(view.getByRole('button'))

    expect(view.getByRole('button').textContent).toBe('c')
    expect(onChange).toHaveBeenLastCalledWith(['c', 'b'])
    view.unmount()
  })

  it('does not promote a rejected controlled selection when control is removed', () => {
    const onChange = vi.fn()
    let setControlled!: (value: boolean) => void
    function Harness() {
      const [controlled, updateControlled] = React.useState(false)
      const [value] = React.useState(['a'])
      setControlled = updateControlled
      const core = useGridCore()
      const selection = useGridSelection(core, {
        value: controlled ? value : undefined,
        defaultValue: ['seed'],
        onChange,
      })
      return (
        <button
          type="button"
          onClick={() => {
            selection.rebase()
            selection.model.toggle('b')
          }}
        >
          {selection.selection.join(',')}
        </button>
      )
    }

    const view = render(<Harness />)
    act(() => setControlled(true))
    fireEvent.click(view.getByRole('button'))
    expect(onChange).toHaveBeenLastCalledWith(['a', 'b'])
    expect(view.getByRole('button').textContent).toBe('a')

    act(() => setControlled(false))
    expect(view.getByRole('button').textContent).toBe('seed')
    view.unmount()
  })

  it('preserves a batched uncontrolled selection across controlled handoff release', () => {
    const onChange = vi.fn()
    const selectionEvent = vi.fn()
    let setControlled!: React.Dispatch<React.SetStateAction<string[] | undefined>>
    let core!: GridCore
    let selection!: ReturnType<typeof useGridSelection>

    function Harness() {
      const [value, updateValue] = React.useState<string[] | undefined>()
      setControlled = updateValue
      core = useGridCore()
      selection = useGridSelection(core, { value, defaultValue: ['a'], onChange })
      return <output data-testid="selection">{JSON.stringify(selection.selection)}</output>
    }

    const view = render(<Harness />)
    core.on(GRID_SELECTION_CHANGE_EVENT, selectionEvent)
    const store = selection.model.store as unknown as Store<string[]>

    act(() => {
      store.batch(() => {
        selection.model.set(['b'])
        setControlled(['c'])
      })
    })

    expect(selection.selection).toEqual(['c'])
    expect(selection.model.get()).toEqual(['c'])
    expect(selection.model.store.getState()).toEqual(['c'])
    expect(view.getByTestId('selection').textContent).toBe('["c"]')
    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange).toHaveBeenCalledWith(['b'])
    expect(selectionEvent).toHaveBeenCalledTimes(1)
    expect(selectionEvent).toHaveBeenCalledWith({ selectedKeys: ['b'] })
    const countsBeforeRelease = {
      onChange: onChange.mock.calls.length,
      selectionEvent: selectionEvent.mock.calls.length,
    }

    act(() => setControlled(undefined))

    expect(selection.selection).toEqual(['b'])
    expect(selection.model.get()).toEqual(['b'])
    expect(selection.model.store.getState()).toEqual(['b'])
    expect(view.getByTestId('selection').textContent).toBe('["b"]')
    expect(onChange).toHaveBeenCalledTimes(countsBeforeRelease.onChange)
    expect(selectionEvent).toHaveBeenCalledTimes(countsBeforeRelease.selectionEvent)
    view.unmount()
  })

  it('keeps selected and expanded bridge snapshots detached from mutable arrays', () => {
    const value = ['a']
    let selectedSnapshot: string[] | undefined
    let expandedSnapshot: string[] | undefined
    function Harness() {
      const core = useGridCore()
      const selection = useGridSelection(core, { value })
      const expansion = useGridExpansion(core, { defaultValue: ['open'] })
      selectedSnapshot ??= selection.selection
      expandedSnapshot ??= expansion.expandedKeys
      return (
        <button
          type="button"
          onClick={() => {
            selection.model.toggle('b')
            expansion.model.toggle('next')
          }}
        >
          {selection.selection.join(',')}|{expansion.expandedKeys.join(',')}
        </button>
      )
    }

    const view = render(<Harness />)
    expandedSnapshot!.push('polluted')
    value.push('mutated')
    fireEvent.click(view.getByRole('button'))

    expect(selectedSnapshot).toEqual(['a'])
    expect(view.getByRole('button').textContent).toBe('a,mutated|open,next')
    view.unmount()
  })

  it('restores the uncontrolled sort after a rejected controlled handoff', () => {
    const A: SortState = { key: 'name', direction: 'asc' }
    const B: SortState = { key: 'age', direction: 'desc' }
    const C: SortState = { key: 'status', direction: 'asc' }
    const onSortChange = vi.fn()
    let setControlled!: React.Dispatch<React.SetStateAction<SortState | undefined>>
    let sorting!: ReturnType<typeof useGridSorting>

    function Harness() {
      const [sort, updateSort] = React.useState<SortState | undefined>()
      setControlled = updateSort
      const core = useGridCore()
      sorting = useGridSorting(core, [], {
        leafColumns: [],
        sort,
        defaultSort: A,
        onSortChange,
      })
      return <output data-testid="sort">{JSON.stringify(sorting.sortState)}</output>
    }

    const view = render(<Harness />)
    expect(sorting.sortState).toEqual(A)

    act(() => setControlled(B))
    expect(sorting.sortState).toEqual(B)
    expect(sorting.model.get().sort).toEqual(B)
    expect(onSortChange).not.toHaveBeenCalled()

    act(() => sorting.model.setSort(C))
    expect(sorting.model.get().sort).toEqual(C)
    expect(sorting.sortState).toEqual(B)
    expect(onSortChange).toHaveBeenLastCalledWith(C)
    const proposalCount = onSortChange.mock.calls.length

    act(() => setControlled(undefined))
    expect(sorting.sortState).toEqual(A)
    expect(sorting.model.get().sort).toEqual(A)
    expect(onSortChange).toHaveBeenCalledTimes(proposalCount)
    expect(view.getByTestId('sort').textContent).toBe(JSON.stringify(A))
    view.unmount()
  })

  it('preserves initial controlled selection and single-sort baselines across a no-op handoff detour', () => {
    const selectionA = ['a']
    const selectionB = ['b']
    const sortA: SortState = { key: 'name', direction: 'asc' }
    const sortB: SortState = { key: 'age', direction: 'desc' }
    const onChange = vi.fn()
    const onSortChange = vi.fn()
    const selectionEvent = vi.fn()
    const sortingEvent = vi.fn()
    let setValue!: React.Dispatch<React.SetStateAction<string[] | undefined>>
    let setSort!: React.Dispatch<React.SetStateAction<SortState | undefined>>
    let selection!: ReturnType<typeof useGridSelection>
    let sorting!: ReturnType<typeof useGridSorting>

    function Harness() {
      const [value, updateValue] = React.useState<string[] | undefined>(selectionA)
      const [sort, updateSort] = React.useState<SortState | undefined>(sortA)
      setValue = updateValue
      setSort = updateSort
      const core = useGridCore()
      selection = useGridSelection(core, { value, onChange })
      sorting = useGridSorting(core, [], { leafColumns: [], sort, onSortChange })
      React.useEffect(() => {
        const unsubscribeSelection = core.on(GRID_SELECTION_CHANGE_EVENT, selectionEvent)
        const unsubscribeSorting = core.on(GRID_SORTING_CHANGE_EVENT, sortingEvent)
        return () => {
          unsubscribeSelection()
          unsubscribeSorting()
        }
      }, [core])
      return null
    }

    const view = render(<Harness />)
    expect(selection.selection).toEqual(selectionA)
    expect(selection.model.get()).toEqual(selectionA)
    expect(sorting.sortState).toEqual(sortA)
    expect(sorting.model.get().sort).toEqual(sortA)
    vi.clearAllMocks()

    act(() => {
      setValue(undefined)
      setSort(undefined)
    })
    expect(selection.selection).toEqual(selectionA)
    expect(selection.model.get()).toEqual(selectionA)
    expect(sorting.sortState).toEqual(sortA)
    expect(sorting.model.get().sort).toEqual(sortA)

    act(() => {
      setValue(selectionB)
      setSort(sortB)
    })
    expect(selection.selection).toEqual(selectionB)
    expect(selection.model.get()).toEqual(selectionB)
    expect(sorting.sortState).toEqual(sortB)
    expect(sorting.model.get().sort).toEqual(sortB)

    act(() => {
      setValue(undefined)
      setSort(undefined)
    })
    expect(selection.selection).toEqual(selectionA)
    expect(selection.model.get()).toEqual(selectionA)
    expect(sorting.sortState).toEqual(sortA)
    expect(sorting.model.get().sort).toEqual(sortA)
    expect(onChange).not.toHaveBeenCalled()
    expect(onSortChange).not.toHaveBeenCalled()
    expect(selectionEvent).not.toHaveBeenCalled()
    expect(sortingEvent).not.toHaveBeenCalled()
    view.unmount()
  })
})
