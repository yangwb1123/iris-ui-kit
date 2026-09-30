import { render } from '@testing-library/svelte'
import { tick } from 'svelte'
import { describe, expect, it, vi } from 'vitest'
import { get, type Readable } from 'svelte/store'
import {
  GRID_VIRTUAL_RANGE_CHANGE_EVENT,
  type GridCore,
  type GridVirtualModel,
  type GridVirtualRangeChange,
  type VirtualizerState,
} from '@iris-ui-kit/core/grid'
import GridVirtualBridgeHarness from './GridVirtualBridgeHarness.svelte'
import GridVirtualReactiveItemsHarness from './GridVirtualReactiveItemsHarness.svelte'

describe('Svelte Grid virtualization', () => {
  it('isolates virtual snapshots while preserving scroll windows', async () => {
    let core!: GridCore<{ id: string }>
    let model!: GridVirtualModel
    let state!: Readable<VirtualizerState>
    const view = render(GridVirtualBridgeHarness, {
      props: {
        items: Array.from({ length: 5 }, (_, index) => ({ id: String(index) })),
        estimateSize: 20,
        viewportSize: 40,
        buffer: 0,
        onCore: (value) => (core = value),
        onModel: (value) => (model = value),
        onState: (value) => (state = value),
      },
    })
    await tick()

    const initial = get(state)
    const internal = model.store.getState()
    const expectWindow = (snapshot: VirtualizerState, indexes: number[], starts: number[]) => {
      expect(snapshot.totalSize).toBe(100)
      expect(snapshot.items.map((item) => item.index)).toEqual(indexes)
      expect(snapshot.items.map((item) => item.start)).toEqual(starts)
      expect(snapshot.items.every((item) => item.size === 20)).toBe(true)
    }

    expect(model).toBe(core.invoke('getVirtualModel'))
    expect(initial).not.toBe(internal)
    expect(initial.items).not.toBe(internal.items)
    expect(initial.items[0]).not.toBe(internal.items[0])
    expectWindow(initial, [0, 1], [0, 20])
    expect(view.getByTestId('virtual-total-size').textContent).toBe('100')
    expect(JSON.parse(view.getByTestId('virtual-indexes').textContent ?? '[]')).toEqual([0, 1])

    initial.offsetBefore = 999
    initial.totalSize = 999
    initial.startIndex = 999
    initial.endIndex = 999
    initial.items[0]!.start = 999
    initial.items[0]!.size = 999
    initial.items.length = 0
    expectWindow(model.store.getState(), [0, 1], [0, 20])
    expectWindow(model.getState(), [0, 1], [0, 20])

    model.setScroll(20)
    await tick()
    expectWindow(get(state), [1, 2], [20, 40])
    expect(view.getByTestId('virtual-total-size').textContent).toBe('100')
    expect(JSON.parse(view.getByTestId('virtual-indexes').textContent ?? '[]')).toEqual([1, 2])

    const emitted = get(state)
    emitted.offsetBefore = 999
    emitted.totalSize = 999
    emitted.items[0]!.start = 999
    emitted.items.length = 0
    expectWindow(model.store.getState(), [1, 2], [20, 40])
    expectWindow(model.getState(), [1, 2], [20, 40])

    model.setScroll(40)
    await tick()
    expectWindow(get(state), [2, 3], [40, 60])
    expect(view.getByTestId('virtual-total-size').textContent).toBe('100')
    expect(JSON.parse(view.getByTestId('virtual-indexes').textContent ?? '[]')).toEqual([2, 3])
    view.unmount()
  })

  it('syncs reactive items and viewport into the existing virtual model', async () => {
    let core!: GridCore<{ id: string }>
    let model!: GridVirtualModel
    const view = render(GridVirtualBridgeHarness, {
      props: {
        items: [{ id: 'a' }],
        estimateSize: 20,
        viewportSize: 20,
        buffer: 0,
        scrollOffset: 0,
        onCore: (value) => (core = value),
        onModel: (value) => (model = value),
      },
    })
    await tick()
    const initialModel = model

    await view.rerender({ items: [{ id: 'a' }, { id: 'b' }, { id: 'c' }], viewportSize: 60 })
    await tick()

    expect(view.getByTestId('virtual-total-size').textContent).toBe('60')
    expect(JSON.parse(view.getByTestId('virtual-indexes').textContent ?? '[]')).toEqual([0, 1, 2])
    expect(initialModel.getState().totalSize).toBe(60)
    expect(initialModel.getState().items.map((item) => item.index)).toEqual([0, 1, 2])
    expect(core.invoke<GridVirtualModel>('getVirtualModel')).toBe(initialModel)
    expect(
      view.container.querySelector('[data-model-identity]')?.getAttribute('data-model-identity'),
    ).toBe('true')
  })

  it('re-seats keyed measurements when getItemKey changes at the same count', async () => {
    type Item = { id: string }
    type KeyOf = (item: Item, index: number) => string
    const items: Item[] = [{ id: 'a' }, { id: 'b' }, { id: 'c' }]
    const oldKey: KeyOf = (item) => `old-${item.id}`
    const newKey: KeyOf = (item) => `new-${item.id}`
    let model!: GridVirtualModel
    const view = render(GridVirtualBridgeHarness, {
      props: {
        items,
        estimateSize: 20,
        viewportSize: 100,
        getItemKey: oldKey,
        onModel: (value) => (model = value),
      },
    })
    await tick()
    const initialModel = model
    const setCount = vi.spyOn(initialModel, 'setCount')
    initialModel.measure(0, 50)
    expect(setCount).not.toHaveBeenCalled()

    expect(initialModel.getState().items).toEqual([
      { index: 0, key: 'old-a', start: 0, size: 50 },
      { index: 1, key: 'old-b', start: 50, size: 20 },
      { index: 2, key: 'old-c', start: 70, size: 20 },
    ])
    expect(initialModel.totalSize()).toBe(90)

    await view.rerender({ getItemKey: newKey })
    await tick()

    expect(setCount).toHaveBeenCalledWith(3)
    expect(model).toBe(initialModel)
    expect(initialModel.getState().items).toEqual([
      { index: 0, key: 'new-a', start: 0, size: 20 },
      { index: 1, key: 'new-b', start: 20, size: 20 },
      { index: 2, key: 'new-c', start: 40, size: 20 },
    ])
    expect(initialModel.totalSize()).toBe(60)
    view.unmount()
  })

  it('commits numeric estimate changes as one final virtual window', async () => {
    const items = Array.from({ length: 100 }, (_, id) => ({ id: String(id) }))
    const rangeChanges: GridVirtualRangeChange[] = []
    const eventChanges: GridVirtualRangeChange[] = []
    let core!: GridCore<{ id: string }>
    let model!: GridVirtualModel
    const view = render(GridVirtualBridgeHarness, {
      props: {
        items,
        estimateSize: 20,
        viewportSize: 100,
        buffer: 0,
        onRangeChange: (change) => rangeChanges.push(change),
        onCore: (value) => (core = value),
        onModel: (value) => (model = value),
      },
    })
    await tick()
    const initialModel = model
    core.on<GridVirtualRangeChange>(GRID_VIRTUAL_RANGE_CHANGE_EVENT, (change) =>
      eventChanges.push(change),
    )

    await view.rerender({ estimateSize: 30 })
    await tick()

    expect(model).toBe(initialModel)
    expect(rangeChanges).toEqual([{ start: 0, end: 4, totalSize: 3000 }])
    expect(eventChanges).toEqual([{ start: 0, end: 4, totalSize: 3000 }])
    expect(initialModel.getState()).toMatchObject({
      startIndex: 0,
      endIndex: 3,
      totalSize: 3000,
    })
    expect(initialModel.getState().items.map((item) => item.index)).toEqual([0, 1, 2, 3])
    expect(rangeChanges.some((change) => change.end === 5 && change.totalSize === 3000)).toBe(false)
    expect(JSON.parse(view.getByTestId('virtual-indexes').textContent ?? '[]')).toEqual([
      0, 1, 2, 3,
    ])
    view.unmount()
  })

  it('syncs estimate, buffer, and scroll into the existing virtual model', async () => {
    let core!: GridCore<{ id: string }>
    let model!: GridVirtualModel
    const view = render(GridVirtualBridgeHarness, {
      props: {
        items: Array.from({ length: 5 }, (_, index) => ({ id: String(index) })),
        estimateSize: 20,
        viewportSize: 20,
        buffer: 0,
        scrollOffset: 0,
        getItemKey: (item) => item.id,
        onCore: (value) => (core = value),
        onModel: (value) => (model = value),
      },
    })
    await tick()
    const initialModel = model
    const readIndexes = (): number[] =>
      JSON.parse(view.getByTestId('virtual-indexes').textContent ?? '[]')

    await view.rerender({ estimateSize: 30 })
    await tick()
    expect(view.getByTestId('virtual-total-size').textContent).toBe('150')
    expect(initialModel.getState().totalSize).toBe(150)
    expect(core.invoke<GridVirtualModel>('getVirtualModel')).toBe(initialModel)

    await view.rerender({ buffer: 1 })
    await tick()
    expect(readIndexes()).toEqual([0, 1])
    expect(initialModel.getState().items.map((item) => item.index)).toEqual([0, 1])
    expect(core.invoke<GridVirtualModel>('getVirtualModel')).toBe(initialModel)

    await view.rerender({ scrollOffset: 60 })
    await tick()
    expect(readIndexes()).toEqual([1, 2, 3])
    expect(initialModel.getState().items.map((item) => item.index)).toEqual([1, 2, 3])
    expect(core.invoke<GridVirtualModel>('getVirtualModel')).toBe(initialModel)
  })

  it('re-seats keyed measurements when a $state item is replaced in place', async () => {
    let model!: GridVirtualModel
    let replaceFirst!: () => void
    const view = render(GridVirtualReactiveItemsHarness, {
      props: {
        onModel: (value) => (model = value),
        onItemsReady: (api) => (replaceFirst = api.replaceFirst),
      },
    })
    await tick()

    model.measure(0, 100)
    expect(model.totalSize()).toBe(140)

    replaceFirst()
    await tick()

    expect(model.getState().items[0]).toEqual({ index: 0, key: 'z', start: 0, size: 20 })
    expect(model.totalSize()).toBe(60)
    view.unmount()
  })
})
