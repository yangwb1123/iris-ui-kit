import { describe, expect, it, vi } from 'vitest'
import {
  createGridColumnsFeature,
  createGridCore,
  GRID_COLUMNS_CHANGE_EVENT,
  type GridColumnsChange,
  type GridColumnsModel,
} from './grid'

describe('createGridColumnsFeature', () => {
  it('composes visibility, order, width, and pin channels in one capability', () => {
    const events: GridColumnsChange[] = []
    const onVisibilityChange = vi.fn()
    const onOrderChange = vi.fn()
    const onWidthsChange = vi.fn()
    const onPinnedChange = vi.fn()
    const core = createGridCore({
      features: [
        createGridColumnsFeature({
          defaultVisibility: { age: false },
          defaultOrder: ['name', 'age'],
          defaultWidths: { name: 120 },
          onVisibilityChange,
          onOrderChange,
          onWidthsChange,
          onPinnedChange,
        }),
      ],
    })
    core.on<GridColumnsChange>(GRID_COLUMNS_CHANGE_EVENT, (event) => events.push(event))

    core.invoke('toggleColumnVisibility', 'age')
    core.invoke('setColumnOrder', ['age', 'name'])
    core.invoke('setColumnWidth', 'age', 80)
    core.invoke('setColumnPinned', 'name', 'left')

    expect(core.invoke('getColumnState')).toEqual({
      visibility: { age: true },
      order: ['age', 'name'],
      widths: { name: 120, age: 80 },
      pinned: { name: 'left' },
    })
    expect(onVisibilityChange).toHaveBeenLastCalledWith({ age: true })
    expect(onOrderChange).toHaveBeenLastCalledWith(['age', 'name'])
    expect(onWidthsChange).toHaveBeenLastCalledWith({ name: 120, age: 80 })
    expect(onPinnedChange).toHaveBeenLastCalledWith('name', 'left')
    expect(events.map((event) => event.channel)).toEqual([
      'visibility',
      'order',
      'widths',
      'pinned',
    ])
  })

  it('isolates callback order mutations from event payload and stored state', () => {
    const onOrderChange = vi.fn((order: string[] | undefined) => {
      if (order) order[0] = 'callback-mutated'
    })
    const event = vi.fn()
    const core = createGridCore({
      features: [createGridColumnsFeature({ onOrderChange })],
    })
    core.on(GRID_COLUMNS_CHANGE_EVENT, event)

    core.invoke('setColumnOrder', ['age', 'name'])

    expect(onOrderChange).toHaveBeenCalledWith(['callback-mutated', 'name'])
    expect(event).toHaveBeenCalledWith({ channel: 'order', order: ['age', 'name'] })
    expect(core.invoke('getColumnState')).toMatchObject({ order: ['age', 'name'] })
  })

  it('keeps callback order payload isolated when an event listener mutates order', () => {
    const onOrderChange = vi.fn()
    const event = vi.fn((change: GridColumnsChange) => {
      if (change.channel === 'order' && change.order) change.order.reverse()
    })
    const core = createGridCore({
      features: [createGridColumnsFeature({ onOrderChange })],
    })
    core.on(GRID_COLUMNS_CHANGE_EVENT, event)

    core.invoke('setColumnOrder', ['age', 'name'])

    expect(onOrderChange).toHaveBeenCalledWith(['age', 'name'])
    expect(event).toHaveBeenCalledWith({ channel: 'order', order: ['name', 'age'] })
    expect(core.invoke('getColumnState')).toMatchObject({ order: ['age', 'name'] })
  })

  it('preserves undefined order reset and explicit null pin overrides', () => {
    const onOrderChange = vi.fn()
    const core = createGridCore({
      features: [createGridColumnsFeature({ onOrderChange })],
    })

    core.invoke('setColumnOrder', ['name'])
    core.invoke('clearColumnOrder')
    core.invoke('setColumnPinned', 'name', null)

    expect(core.invoke('getColumnOrder')).toEqual([])
    expect(onOrderChange).toHaveBeenLastCalledWith(undefined)
    expect(core.invoke('getColumnPinned')).toEqual({ name: null })
  })

  it('deduplicates order keys and treats controlled semantic no-ops as no-ops', () => {
    const onOrderChange = vi.fn()
    const model = createGridColumnsFeature({ onOrderChange })
    const core = createGridCore({ features: [model] })
    const columns = core.invoke<GridColumnsModel>('getColumnsModel')
    let storeNotifications = 0
    columns.store.subscribe(() => storeNotifications++)

    columns.setOrder(['name', 'name', 'age'])
    expect(columns.get().order).toEqual(['name', 'age'])
    expect(onOrderChange).toHaveBeenLastCalledWith(['name', 'age'])

    storeNotifications = 0
    columns.syncWidths({ width: 0 })
    columns.syncWidths({ width: -0 })
    expect(storeNotifications).toBe(1)
    columns.syncWidths({ width: 0 })
    expect(storeNotifications).toBe(1)
  })

  it('handles inherited keys and rejects malformed width and pin values', () => {
    const model = createGridColumnsFeature({
      defaultWidths: { good: 100, bad: Number.NaN, negative: -1 },
      defaultPinned: { good: 'left', bad: 'middle' as never },
    })
    const core = createGridCore({ features: [model] })

    core.invoke('toggleColumnVisibility', 'toString')
    core.invoke('setColumnWidth', 'good', Number.POSITIVE_INFINITY)
    core.invoke('setColumnPinned', 'bad', 'middle')

    expect(core.invoke('getColumnVisibility')).toEqual({ toString: false })
    expect(core.invoke('getColumnWidths')).toEqual({ good: 100 })
    expect(core.invoke('getColumnPinned')).toEqual({ good: 'left' })
  })

  it('stops callbacks and events from a retained model after grid disposal', () => {
    const onWidthsChange = vi.fn()
    const event = vi.fn()
    const core = createGridCore({ features: [createGridColumnsFeature({ onWidthsChange })] })
    const model = core.invoke<GridColumnsModel>('getColumnsModel')
    core.on(GRID_COLUMNS_CHANGE_EVENT, event)
    core.destroy()

    model.setWidth('name', 120)

    expect(onWidthsChange).not.toHaveBeenCalled()
    expect(event).not.toHaveBeenCalled()
    expect(model.get().widths).toEqual({ name: 120 })
  })

  it('silently synchronizes controlled state without callbacks or events', () => {
    const onWidthsChange = vi.fn()
    const event = vi.fn()
    const core = createGridCore({
      features: [createGridColumnsFeature({ onWidthsChange })],
    })
    core.on(GRID_COLUMNS_CHANGE_EVENT, event)

    core.invoke('syncColumnState', {
      visibility: { age: false },
      order: ['age'],
      widths: { age: 90 },
      pinned: { age: 'right' },
    })

    expect(core.invoke('getColumnState')).toEqual({
      visibility: { age: false },
      order: ['age'],
      widths: { age: 90 },
      pinned: { age: 'right' },
    })
    expect(onWidthsChange).not.toHaveBeenCalled()
    expect(event).not.toHaveBeenCalled()
  })
})
