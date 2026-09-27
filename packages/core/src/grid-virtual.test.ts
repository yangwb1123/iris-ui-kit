import { describe, expect, it, vi } from 'vitest'
import type { Virtualizer, VirtualizerState } from './virtualizer'
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

  it('updates estimates through the capability without dropping measurements', () => {
    const core = createGridCore({
      features: [
        createGridVirtualFeature({
          count: 3,
          estimateSize: 20,
          viewportSize: 1000,
        }),
      ],
    })

    core.invoke('measureVirtualItem', 0, 40)
    core.invoke('setVirtualEstimateSize', 30)

    expect(core.invoke<VirtualizerState>('getVirtualState').items.map((item) => item.size)).toEqual(
      [40, 30, 30],
    )
  })

  it('commits numeric estimate and fixed-size range changes atomically', () => {
    const onRangeChange = vi.fn()
    const core = createGridCore({
      features: [
        createGridVirtualFeature({
          count: 100,
          estimateSize: 20,
          fixedSize: 20,
          viewportSize: 100,
          buffer: 0,
          onRangeChange,
        }),
      ],
    })
    const model = core.invoke<Virtualizer>('getVirtualModel')
    const states: VirtualizerState[] = []
    const ranges: GridVirtualRangeChange[] = []
    const unsubscribe = model.subscribe((state) => states.push(state))
    core.on<GridVirtualRangeChange>(GRID_VIRTUAL_RANGE_CHANGE_EVENT, (range) => ranges.push(range))

    core.invoke('setVirtualEstimateSize', 30)

    expect(states).toHaveLength(1)
    expect(states[0]).toMatchObject({ startIndex: 0, endIndex: 3, totalSize: 3000 })
    expect(states[0]?.items.map((item) => item.index)).toEqual([0, 1, 2, 3])
    expect(onRangeChange).toHaveBeenCalledOnce()
    expect(onRangeChange).toHaveBeenCalledWith({ start: 0, end: 4, totalSize: 3000 })
    expect(ranges).toEqual([{ start: 0, end: 4, totalSize: 3000 }])
    expect(states).not.toContainEqual(expect.objectContaining({ endIndex: 4, totalSize: 3000 }))

    core.invoke('setVirtualEstimateSize', 30)
    expect(states).toHaveLength(1)
    expect(onRangeChange).toHaveBeenCalledOnce()
    expect(ranges).toHaveLength(1)

    unsubscribe()
    core.destroy()
  })

  it('constructs and exposes state without a global process', () => {
    const processDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'process')
    let core: ReturnType<typeof createGridCore> | undefined
    let state: VirtualizerState | undefined

    try {
      expect(Reflect.deleteProperty(globalThis, 'process')).toBe(true)
      expect(() => {
        const created = createGridCore({
          features: [
            createGridVirtualFeature({
              count: 3,
              estimateSize: 20,
              viewportSize: 40,
            }),
          ],
        })
        core = created
        state = created.invoke<VirtualizerState>('getVirtualState')
      }).not.toThrow()

      expect(state).toMatchObject({ startIndex: 0, endIndex: 1, totalSize: 60 })
      expect(state?.items).toEqual([
        { index: 0, key: 0, start: 0, size: 20 },
        { index: 1, key: 1, start: 20, size: 20 },
      ])
    } finally {
      core?.destroy()
      if (processDescriptor) {
        Object.defineProperty(globalThis, 'process', processDescriptor)
      } else {
        Reflect.deleteProperty(globalThis, 'process')
      }
    }
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

  // TC-C — acceptance 3: feature path forwards setVirtualFixedSize to core
  it('keeps the offset-tree window when setVirtualFixedSize disagrees with the estimate', () => {
    const core = createGridCore({
      features: [createGridVirtualFeature({ count: 10, estimateSize: 40, viewportSize: 100 })],
    })

    core.invoke('setVirtualFixedSize', 30)
    core.invoke('setVirtualScroll', 120)

    const state = core.invoke<VirtualizerState>('getVirtualState')
    expect(state.offsetBefore).toBeLessThanOrEqual(120)
    expect(state.items.some((item) => item.start <= 120 && item.start + item.size > 120)).toBe(true)
    expect(state.totalSize).toBe(400)
  })
})
