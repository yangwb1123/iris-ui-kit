import { cleanup, render, renderHook, waitFor } from '@solidjs/testing-library'
import { createSignal } from 'solid-js'
import { createStore } from 'solid-js/store'
import { describe, expect, it, afterEach, vi } from 'vitest'
import { GridCore, GridVirtualRangeChange } from '@iris-ui-kit/core/grid'
import { useGridCore, useGridVirtual } from './index'

afterEach(cleanup)

describe('Solid Grid Core bridge — virtualization', () => {
  it('re-seats keyed measurements when getItemKey changes at the same count', async () => {
    type Item = { id: string }
    type KeyOf = (item: Item, index: number) => string
    type Props = {
      items: readonly Item[]
      estimateSize: number
      viewportSize: number
      getItemKey: KeyOf
    }
    const items: Item[] = [{ id: 'a' }, { id: 'b' }, { id: 'c' }]
    const oldKey: KeyOf = (item) => `old-${item.id}`
    const newKey: KeyOf = (item) => `new-${item.id}`
    let setKey!: (keyOf: KeyOf) => void
    let virtual!: ReturnType<typeof useGridVirtual>

    const Harness = (props: Props) => {
      const core = useGridCore<Item>()
      virtual = useGridVirtual(core, props)
      return <div />
    }
    const Parent = () => {
      const [getItemKey, updateKey] = createSignal<KeyOf>(oldKey)
      setKey = (keyOf) => updateKey(() => keyOf)
      return (
        <Harness items={items} estimateSize={20} viewportSize={100} getItemKey={getItemKey()} />
      )
    }

    const view = render(() => <Parent />)
    const initialModel = virtual.model
    const setCount = vi.spyOn(initialModel, 'setCount')
    initialModel.measure(0, 50)
    expect(setCount).not.toHaveBeenCalled()

    expect(initialModel.getState().items).toEqual([
      { index: 0, key: 'old-a', start: 0, size: 50 },
      { index: 1, key: 'old-b', start: 50, size: 20 },
      { index: 2, key: 'old-c', start: 70, size: 20 },
    ])
    expect(initialModel.totalSize()).toBe(90)

    setKey(newKey)
    await waitFor(() =>
      expect(initialModel.getState().items.map((item) => item.key)).toEqual([
        'new-a',
        'new-b',
        'new-c',
      ]),
    )

    expect(setCount).toHaveBeenCalledWith(3)
    expect(virtual.model).toBe(initialModel)
    expect(initialModel.getState().items).toEqual([
      { index: 0, key: 'new-a', start: 0, size: 20 },
      { index: 1, key: 'new-b', start: 20, size: 20 },
      { index: 2, key: 'new-c', start: 40, size: 20 },
    ])
    expect(initialModel.totalSize()).toBe(60)
    view.unmount()
  })

  it('forwards replacement virtual range callbacks without recreating the model', async () => {
    type Item = { id: number }
    type RangeCallback = (change: GridVirtualRangeChange) => void
    type Props = {
      items: readonly Item[]
      estimateSize: number
      viewportSize: number
      onRangeChange?: RangeCallback
    }
    const items = Array.from({ length: 10 }, (_, id) => ({ id }))
    const oldCallback = vi.fn<RangeCallback>()
    const newCallback = vi.fn<RangeCallback>()
    let setCallback!: (callback: RangeCallback) => void
    let core!: GridCore<Item>
    let virtual!: ReturnType<typeof useGridVirtual>

    const Harness = (props: Props) => {
      core = useGridCore<Item>()
      virtual = useGridVirtual(core, props)
      return <div />
    }
    const Parent = () => {
      const [onRangeChange, updateCallback] = createSignal<RangeCallback>(oldCallback)
      setCallback = (callback) => updateCallback(() => callback)
      return (
        <Harness
          items={items}
          estimateSize={20}
          viewportSize={40}
          onRangeChange={onRangeChange()}
        />
      )
    }

    const view = render(() => <Parent />)
    const initialModel = virtual.model

    expect(oldCallback).not.toHaveBeenCalled()
    expect(newCallback).not.toHaveBeenCalled()

    setCallback(newCallback)
    await waitFor(() => {
      expect(virtual.model).toBe(initialModel)
      expect(oldCallback).not.toHaveBeenCalled()
      expect(newCallback).not.toHaveBeenCalled()
    })

    expect(core.invoke('getVirtualModel')).toBe(initialModel)

    initialModel.setScroll(20)
    await waitFor(() => expect(newCallback).toHaveBeenCalledTimes(1))

    expect(oldCallback).not.toHaveBeenCalled()
    expect(newCallback).toHaveBeenCalledWith({ start: 1, end: 3, totalSize: 200 })

    initialModel.setScroll(20)
    expect(oldCallback).not.toHaveBeenCalled()
    expect(newCallback).toHaveBeenCalledTimes(1)
    view.unmount()
  })

  it('isolates virtual snapshots while preserving scroll windows', async () => {
    const { result } = renderHook(() => {
      const core = useGridCore<{ id: string }>()
      const virtual = useGridVirtual(core, {
        items: Array.from({ length: 5 }, (_, index) => ({ id: String(index) })),
        estimateSize: 20,
        viewportSize: 40,
        buffer: 0,
      })
      return { core, virtual }
    })
    const model = result.virtual.model
    const initial = result.virtual.state()
    const internal = model.store.getState()
    const expectWindow = (state: typeof initial, indexes: number[], starts: number[]) => {
      expect(state.totalSize).toBe(100)
      expect(state.items.map((item) => item.index)).toEqual(indexes)
      expect(state.items.map((item) => item.start)).toEqual(starts)
      expect(state.items.every((item) => item.size === 20)).toBe(true)
    }

    expect(model).toBe(result.core.invoke('getVirtualModel'))
    expect(initial).not.toBe(internal)
    expect(initial.items).not.toBe(internal.items)
    expect(initial.items[0]).not.toBe(internal.items[0])
    expectWindow(initial, [0, 1], [0, 20])

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
    await waitFor(() => expectWindow(result.virtual.state(), [1, 2], [20, 40]))

    const emitted = result.virtual.state()
    emitted.offsetBefore = 999
    emitted.totalSize = 999
    emitted.items[0]!.start = 999
    emitted.items.length = 0
    expectWindow(model.store.getState(), [1, 2], [20, 40])
    expectWindow(model.getState(), [1, 2], [20, 40])

    model.setScroll(40)
    await waitFor(() => expectWindow(result.virtual.state(), [2, 3], [40, 60]))
  })

  it('re-seats keyed measurements after a store index write at the same count', () => {
    type Item = { id: string }
    const [store, setStore] = createStore<{ items: Item[] }>({
      items: [{ id: 'a' }, { id: 'b' }, { id: 'c' }],
    })
    let virtual!: ReturnType<typeof useGridVirtual>
    const Harness = () => {
      const core = useGridCore<Item>()
      virtual = useGridVirtual(core, {
        items: store.items,
        estimateSize: 20,
        viewportSize: 100,
        getItemKey: (item) => item.id,
      })
      return <div />
    }
    const view = render(() => <Harness />)

    virtual.model.measure(0, 100)
    expect(virtual.model.totalSize()).toBe(140)

    setStore('items', 0, { id: 'z' })

    expect(virtual.model.getState().items[0]).toEqual({ index: 0, key: 'z', start: 0, size: 20 })
    expect(virtual.model.totalSize()).toBe(60)
    view.unmount()
  })
})
