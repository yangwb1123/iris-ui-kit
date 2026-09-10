import { describe, expect, it, vi } from 'vitest'
import {
  createGridCore,
  createGridSortingFeature,
  GRID_SORTING_CHANGE_EVENT,
  type GridSortingChange,
  type GridSortingMethods,
} from './grid'

describe('createGridSortingFeature', () => {
  it('composes tri-state single sorting, methods, callback, and event', () => {
    const onSortChange = vi.fn()
    const events: GridSortingChange[] = []
    const core = createGridCore({
      features: [createGridSortingFeature({ onSortChange })],
    })
    core.on<GridSortingChange>(GRID_SORTING_CHANGE_EVENT, (event) => events.push(event))
    expect(core.invoke('getSortingModel')).toBeDefined()
    const cycle = core.getMethod<GridSortingMethods['cycleSort']>('cycleSort')

    cycle?.('name')
    cycle?.('name')
    cycle?.('name')

    expect(core.invoke('getSort')).toBeNull()
    expect(onSortChange).toHaveBeenCalledTimes(3)
    expect(events).toEqual([
      { mode: 'single', sort: { key: 'name', direction: 'asc' } },
      { mode: 'single', sort: { key: 'name', direction: 'desc' } },
      { mode: 'single', sort: null },
    ])
  })

  it('cycles multiple columns in click order and clears through the active mode', () => {
    const core = createGridCore({
      features: [createGridSortingFeature({ mode: 'multiple' })],
    })

    core.invoke('cycleMultiSort', 'name')
    core.invoke('cycleMultiSort', 'age')
    core.invoke('cycleMultiSort', 'name')

    expect(core.invoke('getMultiSort')).toEqual([
      { key: 'name', direction: 'desc' },
      { key: 'age', direction: 'asc' },
    ])
    core.invoke('clearSort')
    expect(core.invoke('getMultiSort')).toEqual([])
  })

  it('supports silent controlled-state synchronization', () => {
    const onSortChange = vi.fn()
    const onMultiSortChange = vi.fn()
    const event = vi.fn()
    const core = createGridCore({
      features: [createGridSortingFeature({ onSortChange, onMultiSortChange })],
    })
    core.on(GRID_SORTING_CHANGE_EVENT, event)

    core.invoke('syncSort', { key: 'name', direction: 'desc' })
    core.invoke('syncMultiSort', [{ key: 'age', direction: 'asc' }])

    expect(core.invoke('getSort')).toEqual({ key: 'name', direction: 'desc' })
    expect(core.invoke('getMultiSort')).toEqual([{ key: 'age', direction: 'asc' }])
    expect(onSortChange).not.toHaveBeenCalled()
    expect(onMultiSortChange).not.toHaveBeenCalled()
    expect(event).not.toHaveBeenCalled()
  })

  it('does not emit when setters receive equivalent fresh objects', () => {
    const onSortChange = vi.fn()
    const onMultiSortChange = vi.fn()
    const event = vi.fn()
    const core = createGridCore({
      features: [
        createGridSortingFeature({
          defaultSort: { key: 'name', direction: 'asc' },
          defaultMultiSort: [{ key: 'age', direction: 'desc' }],
          onSortChange,
          onMultiSortChange,
        }),
      ],
    })
    core.on(GRID_SORTING_CHANGE_EVENT, event)
    const stateChange = vi.fn()
    core.invoke('getSortingModel').store.subscribe(stateChange)

    core.invoke('setSort', { key: 'name', direction: 'asc' })
    core.invoke('setMultiSort', [{ key: 'age', direction: 'desc' }])

    expect(onSortChange).not.toHaveBeenCalled()
    expect(onMultiSortChange).not.toHaveBeenCalled()
    expect(event).not.toHaveBeenCalled()
    expect(stateChange).not.toHaveBeenCalled()
  })
})
