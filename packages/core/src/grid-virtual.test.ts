import { describe, expect, it, vi } from 'vitest'
import type { Virtualizer } from './virtualizer'
import { createGridCore } from './grid'
import {
  createGridVirtualFeature,
  GRID_VIRTUAL_RANGE_CHANGE_EVENT,
  type GridVirtualRangeChange,
} from './grid-virtual'

describe('createGridVirtualFeature', () => {
  it('owns the window and exposes capability-scoped methods', () => {
    const core = createGridCore({
      features: [
        createGridVirtualFeature({
          count: 100,
          estimateSize: 20,
          viewportSize: 100,
          buffer: 1,
        }),
      ],
    })

    expect(core.features).toContain('virtual')
    expect(core.invoke('getVirtualState')).toMatchObject({ startIndex: 0, endIndex: 5 })
    expect(core.invoke('scrollToIndex', 10)).toBe(200)
    expect(core.invoke('getVirtualState')).toMatchObject({ startIndex: 9, endIndex: 15 })

    core.invoke('setVirtualBuffer', 3)
    expect(core.invoke('getVirtualState')).toMatchObject({ startIndex: 7, endIndex: 17 })
  })

  it('emits exclusive ranges only when the rendered window changes', () => {
    const onRangeChange = vi.fn()
    const core = createGridCore({
      features: [
        createGridVirtualFeature({
          count: 20,
          estimateSize: 10,
          viewportSize: 30,
          onRangeChange,
        }),
      ],
    })
    const observed: GridVirtualRangeChange[] = []
    core.on<GridVirtualRangeChange>(GRID_VIRTUAL_RANGE_CHANGE_EVENT, (range) =>
      observed.push(range),
    )

    core.invoke('setVirtualScroll', 20)
    core.invoke('setVirtualScroll', 20)

    expect(onRangeChange).toHaveBeenCalledTimes(1)
    expect(observed).toEqual([{ start: 2, end: 5, totalSize: 200 }])
  })

  it('isolates callback payload mutation from the event and range comparison', () => {
    const callbackSnapshots: GridVirtualRangeChange[] = []
    const onRangeChange = vi.fn((range: GridVirtualRangeChange) => {
      callbackSnapshots.push({ ...range })
      const mutable = range as unknown as { start: number }
      mutable.start = -1
    })
    const core = createGridCore({
      features: [
        createGridVirtualFeature({
          count: 20,
          estimateSize: 10,
          viewportSize: 30,
          onRangeChange,
        }),
      ],
    })
    const eventSnapshots: GridVirtualRangeChange[] = []
    let eventPayload: GridVirtualRangeChange | undefined
    core.on<GridVirtualRangeChange>(GRID_VIRTUAL_RANGE_CHANGE_EVENT, (range) => {
      eventPayload = range
      eventSnapshots.push({ ...range })
    })

    core.invoke('setVirtualScroll', 20)
    core.invoke('setVirtualScroll', 20)

    expect(callbackSnapshots).toEqual([{ start: 2, end: 5, totalSize: 200 }])
    expect(eventSnapshots).toEqual([{ start: 2, end: 5, totalSize: 200 }])
    expect(onRangeChange.mock.calls[0]?.[0]).not.toBe(eventPayload)
    expect(onRangeChange).toHaveBeenCalledTimes(1)
  })

  it('isolates event payload mutation from the callback and range comparison', () => {
    const callbackSnapshots: GridVirtualRangeChange[] = []
    const onRangeChange = vi.fn((range: GridVirtualRangeChange) => {
      callbackSnapshots.push({ ...range })
    })
    const core = createGridCore({
      features: [
        createGridVirtualFeature({
          count: 20,
          estimateSize: 10,
          viewportSize: 30,
          onRangeChange,
        }),
      ],
    })
    const eventSnapshots: GridVirtualRangeChange[] = []
    let eventPayload: GridVirtualRangeChange | undefined
    core.on<GridVirtualRangeChange>(GRID_VIRTUAL_RANGE_CHANGE_EVENT, (range) => {
      eventPayload = range
      eventSnapshots.push({ ...range })
      const mutable = range as unknown as { end: number }
      mutable.end = -1
    })

    core.invoke('setVirtualScroll', 20)
    core.invoke('setVirtualScroll', 20)

    expect(callbackSnapshots).toEqual([{ start: 2, end: 5, totalSize: 200 }])
    expect(eventSnapshots).toEqual([{ start: 2, end: 5, totalSize: 200 }])
    expect(onRangeChange.mock.calls[0]?.[0]).not.toBe(eventPayload)
    expect(onRangeChange).toHaveBeenCalledTimes(1)
  })

  it('normalizes invalid fixed-size input without producing an invalid range', () => {
    const core = createGridCore({
      features: [
        createGridVirtualFeature({
          count: 10,
          estimateSize: 20,
          fixedSize: 0,
          viewportSize: 40,
        }),
      ],
    })

    expect(core.invoke('getVirtualState')).toMatchObject({ startIndex: 0, endIndex: 1 })
    expect(core.invoke('getVirtualState').items).toEqual([
      expect.objectContaining({ index: 0 }),
      expect.objectContaining({ index: 1 }),
    ])
  })

  it('keeps measurements behind the feature API and stops events on destroy', () => {
    const onRangeChange = vi.fn()
    const core = createGridCore({
      features: [
        createGridVirtualFeature({
          count: 3,
          estimateSize: 20,
          viewportSize: 100,
          getItemKey: (index) => `row-${index}`,
          onRangeChange,
        }),
      ],
    })
    const model = core.invoke<Virtualizer>('getVirtualModel')

    core.invoke('measureVirtualItem', 0, 50)
    expect(model.totalSize()).toBe(90)
    core.destroy()
    model.measure(1, 40)
    expect(onRangeChange).toHaveBeenCalledTimes(1)
  })
})
