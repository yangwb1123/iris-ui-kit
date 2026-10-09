import { describe, expect, it, vi } from 'vitest'
import {
  createGridColumnsFeature,
  createGridColumnsModel,
  createGridCore,
  GRID_COLUMNS_CHANGE_EVENT,
  type GridColumnsModel,
} from './grid'

describe('grid columns controlled state and ownership', () => {
  it('owns default maps and snapshots, including prototype-shaped column keys', () => {
    const visibility = { ['__proto__']: false, name: true }
    const order = ['name', '__proto__', 'name']
    const widths = { ['__proto__']: 80, name: 120 }
    const pinned: Record<string, 'left'> = { ['__proto__']: 'left' }
    const model = createGridColumnsModel({
      defaultVisibility: visibility,
      defaultOrder: order,
      defaultWidths: widths,
      defaultPinned: pinned,
    })
    visibility.name = false
    order.reverse()
    widths.name = 1
    delete pinned.__proto__
    const snapshot = model.get()
    expect(snapshot).toEqual({
      visibility: { ['__proto__']: false, name: true },
      order: ['name', '__proto__'],
      widths: { ['__proto__']: 80, name: 120 },
      pinned: { ['__proto__']: 'left' },
    })
    expect(Object.getPrototypeOf(snapshot.visibility)).toBe(Object.prototype)
    snapshot.visibility.name = false
    snapshot.order.pop()
    snapshot.widths.name = 0
    snapshot.pinned.__proto__ = null
    expect(model.get().visibility.name).toBe(true)
    expect(model.get().order).toEqual(['name', '__proto__'])
    expect(model.get().widths.name).toBe(120)
    expect(model.get().pinned.__proto__).toBe('left')
  })

  it('silently syncs visibility additions, value changes, removals, and own-key replacements', () => {
    const callback = vi.fn()
    const event = vi.fn()
    const model = createGridColumnsModel({ onVisibilityChange: callback }, event)
    model.syncVisibility({ name: false })
    expect(model.get().visibility).toEqual({ name: false })
    const first = model.store.getState()
    model.syncVisibility({ name: false })
    expect(model.store.getState()).toBe(first)
    model.syncVisibility({ name: true })
    expect(model.get().visibility).toEqual({ name: true })
    model.syncVisibility({ age: true })
    expect(model.get().visibility).toEqual({ age: true })
    const inherited = Object.create({ age: true }) as Record<string, boolean>
    model.syncVisibility(inherited)
    expect(model.get().visibility).toEqual({})
    expect(callback).not.toHaveBeenCalled()
    expect(event).not.toHaveBeenCalled()
  })

  it('normalizes controlled widths and pins without publishing user changes', () => {
    const onWidthsChange = vi.fn()
    const onPinnedChange = vi.fn()
    const event = vi.fn()
    const model = createGridColumnsModel({ onWidthsChange, onPinnedChange }, event)
    model.syncWidths({ name: 0, invalid: Number.NaN })
    expect(model.get().widths).toEqual({ name: 0 })
    const zero = model.store.getState()
    model.syncWidths({ name: -0, invalid: -1 })
    expect(model.store.getState()).toBe(zero)
    model.syncWidths({ name: 90 })
    expect(model.get().widths).toEqual({ name: 90 })
    model.syncWidths({ age: 90 })
    expect(model.get().widths).toEqual({ age: 90 })
    model.syncWidths({ invalid: Infinity })
    expect(model.get().widths).toEqual({})

    model.syncPinned({ name: 'left' })
    expect(model.get().pinned).toEqual({ name: 'left' })
    const left = model.store.getState()
    model.syncPinned({ name: 'left', invalid: 'middle' as never })
    expect(model.store.getState()).toBe(left)
    model.syncPinned({ name: 'right' })
    expect(model.get().pinned).toEqual({ name: 'right' })
    model.syncPinned({ age: null })
    expect(model.get().pinned).toEqual({ age: null })
    model.syncPinned({})
    expect(model.get().pinned).toEqual({})
    expect(onWidthsChange).not.toHaveBeenCalled()
    expect(onPinnedChange).not.toHaveBeenCalled()
    expect(event).not.toHaveBeenCalled()
  })

  it('deduplicates controlled order while preserving identity for equivalent sequences', () => {
    const callback = vi.fn()
    const event = vi.fn()
    const model = createGridColumnsModel({ onOrderChange: callback }, event)
    model.syncOrder(['name', 'age', 'name'])
    expect(model.get().order).toEqual(['name', 'age'])
    const previous = model.store.getState()
    model.syncOrder(['name', 'name', 'age'])
    expect(model.store.getState()).toBe(previous)
    model.syncOrder(['age', 'name'])
    expect(model.get().order).toEqual(['age', 'name'])
    model.syncOrder([])
    expect(model.get().order).toEqual([])
    expect(callback).not.toHaveBeenCalled()
    expect(event).not.toHaveBeenCalled()
  })

  it('merges partial syncs atomically and retains omitted channels', () => {
    const event = vi.fn()
    const model = createGridColumnsModel(
      {
        defaultVisibility: { name: true },
        defaultOrder: ['name', 'age'],
        defaultWidths: { name: 90 },
        defaultPinned: { name: 'left' },
      },
      event,
    )
    const original = model.store.getState()
    model.sync({})
    model.sync({ visibility: { name: true }, order: ['name', 'name', 'age'] })
    expect(model.store.getState()).toBe(original)
    model.sync({ visibility: { name: false } })
    expect(model.get()).toEqual({
      visibility: { name: false },
      order: ['name', 'age'],
      widths: { name: 90 },
      pinned: { name: 'left' },
    })
    model.sync({ visibility: { age: false } })
    expect(model.get().visibility).toEqual({ age: false })
    model.sync({ visibility: {} })
    expect(model.get().visibility).toEqual({})
    model.sync({ order: ['name'] })
    expect(model.get().order).toEqual(['name'])
    model.sync({ order: ['age'] })
    expect(model.get().order).toEqual(['age'])
    model.sync({ widths: { name: 100 } })
    expect(model.get().widths).toEqual({ name: 100 })
    model.sync({ widths: { age: 100 } })
    expect(model.get().widths).toEqual({ age: 100 })
    model.sync({ pinned: { name: 'right' } })
    expect(model.get().pinned).toEqual({ name: 'right' })
    model.sync({ pinned: { age: null } })
    expect(model.get().pinned).toEqual({ age: null })
    const settled = model.store.getState()
    model.sync({
      visibility: {},
      order: ['age', 'age'],
      widths: { age: 100, invalid: -1 },
      pinned: { age: null, invalid: 'middle' as never },
    })
    expect(model.store.getState()).toBe(settled)
    expect(event).not.toHaveBeenCalled()
  })

  it('keeps a retained model usable while stopping every feature callback after disposal', () => {
    const visibility = vi.fn()
    const order = vi.fn()
    const widths = vi.fn()
    const pinned = vi.fn()
    const event = vi.fn()
    const core = createGridCore({
      features: [
        createGridColumnsFeature({
          onVisibilityChange: visibility,
          onOrderChange: order,
          onWidthsChange: widths,
          onPinnedChange: pinned,
        }),
      ],
    })
    const model = core.invoke<GridColumnsModel>('getColumnsModel')
    core.on(GRID_COLUMNS_CHANGE_EVENT, event)
    model.setVisibility({ name: false })
    model.setOrder(['name'])
    model.setWidth('name', 80)
    model.setPinned('name', 'left')
    expect(visibility).toHaveBeenCalledWith({ name: false })
    expect(order).toHaveBeenCalledWith(['name'])
    expect(widths).toHaveBeenCalledWith({ name: 80 })
    expect(pinned).toHaveBeenCalledWith('name', 'left')
    expect(event).toHaveBeenLastCalledWith({
      channel: 'pinned',
      key: 'name',
      side: 'left',
      pinned: { name: 'left' },
    })
    core.destroy()
    for (const callback of [visibility, order, widths, pinned, event]) callback.mockClear()
    model.toggleVisibility('name')
    model.setOrder(undefined)
    model.setWidths({ age: 100 })
    model.setPinned('name', null)
    expect(model.get()).toEqual({
      visibility: { name: true },
      order: [],
      widths: { age: 100 },
      pinned: { name: null },
    })
    for (const callback of [visibility, order, widths, pinned, event]) {
      expect(callback).not.toHaveBeenCalled()
    }
  })
})
