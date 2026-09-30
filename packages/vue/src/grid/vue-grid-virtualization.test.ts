import { defineComponent, h, nextTick, reactive, type PropType } from 'vue'
import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import {
  GRID_VIRTUAL_RANGE_CHANGE_EVENT,
  type GridCore,
  type GridVirtualRangeChange,
} from '@iris-ui-kit/core/grid'
import { useGridCore, useGridVirtual } from './index'

describe('Vue Grid vue grid virtualization', () => {
  it('initializes the virtualizer without a global process', () => {
    const processDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'process')
    const items = Array.from({ length: 3 }, (_, id) => ({ id }))
    let core: GridCore<{ id: number }> | undefined
    let virtual: ReturnType<typeof useGridVirtual> | undefined
    let wrapper: ReturnType<typeof mount> | undefined
    const Harness = defineComponent({
      setup() {
        core = useGridCore<{ id: number }>()
        virtual = useGridVirtual(core, {
          items,
          estimateSize: 20,
          viewportSize: 40,
        })
        return () => h('div')
      },
    })

    try {
      expect(Reflect.deleteProperty(globalThis, 'process')).toBe(true)
      expect(() => {
        wrapper = mount(Harness)
      }).not.toThrow()

      expect(core?.hasFeature('virtual')).toBe(true)
      expect(core?.invoke('getVirtualModel')).toBe(virtual?.model)
      expect(virtual?.state.value).toMatchObject({
        totalSize: 60,
        startIndex: 0,
        endIndex: 1,
      })
      expect(virtual?.state.value.items).toEqual([
        { index: 0, key: 0, start: 0, size: 20 },
        { index: 1, key: 1, start: 20, size: 20 },
      ])
    } finally {
      try {
        if (wrapper) wrapper.unmount()
        else core?.destroy()
      } finally {
        if (processDescriptor) {
          Object.defineProperty(globalThis, 'process', processDescriptor)
        } else {
          Reflect.deleteProperty(globalThis, 'process')
        }
      }
    }
  })

  it('commits numeric estimate changes as one final virtual window', async () => {
    type Item = { id: number }
    type RangeCallback = (change: GridVirtualRangeChange) => void
    const items = Array.from({ length: 100 }, (_, id) => ({ id }))
    const rangeChanges = vi.fn<RangeCallback>()
    const eventChanges: GridVirtualRangeChange[] = []
    let core!: GridCore<Item>
    let virtual!: ReturnType<typeof useGridVirtual>

    const Harness = defineComponent({
      props: {
        items: { type: Array as PropType<Item[]>, required: true },
        estimateSize: { type: Number, required: true },
        viewportSize: { type: Number, required: true },
        buffer: { type: Number, required: true },
        onRangeChange: Function as PropType<RangeCallback>,
      },
      setup(props) {
        core = useGridCore<Item>()
        core.on<GridVirtualRangeChange>(GRID_VIRTUAL_RANGE_CHANGE_EVENT, (change) =>
          eventChanges.push(change),
        )
        virtual = useGridVirtual(core, props)
        return () =>
          h(
            'div',
            { 'data-testid': 'virtual-items' },
            virtual.state.value.items.map((item) =>
              h('span', { 'data-index': item.index, key: item.index }, String(item.index)),
            ),
          )
      },
    })

    const wrapper = mount(Harness, {
      props: {
        items,
        estimateSize: 20,
        viewportSize: 100,
        buffer: 0,
        onRangeChange: rangeChanges,
      },
    })
    const initialModel = virtual.model

    await wrapper.setProps({ estimateSize: 30 })
    await nextTick()

    expect(virtual.model).toBe(initialModel)
    expect(rangeChanges).toHaveBeenCalledTimes(1)
    expect(rangeChanges).toHaveBeenCalledWith({ start: 0, end: 4, totalSize: 3000 })
    expect(eventChanges).toEqual([{ start: 0, end: 4, totalSize: 3000 }])
    expect(initialModel.getState()).toMatchObject({
      startIndex: 0,
      endIndex: 3,
      totalSize: 3000,
    })
    expect(initialModel.getState().items.map((item) => item.index)).toEqual([0, 1, 2, 3])
    expect(
      rangeChanges.mock.calls.some(([change]) => change.end === 5 && change.totalSize === 3000),
    ).toBe(false)
    expect(
      [
        ...wrapper.get('[data-testid="virtual-items"]').element.querySelectorAll('[data-index]'),
      ].map((element) => Number(element.getAttribute('data-index'))),
    ).toEqual([0, 1, 2, 3])
    wrapper.unmount()
  })

  it('re-seats keyed measurements when getItemKey changes at the same count', async () => {
    type Item = { id: string }
    type KeyOf = (item: Item, index: number) => string
    const items: Item[] = [{ id: 'a' }, { id: 'b' }, { id: 'c' }]
    const oldKey: KeyOf = (item) => `old-${item.id}`
    const newKey: KeyOf = (item) => `new-${item.id}`
    let virtual!: ReturnType<typeof useGridVirtual>
    const Harness = defineComponent({
      props: {
        items: { type: Array as PropType<Item[]>, required: true },
        estimateSize: { type: Number, required: true },
        viewportSize: { type: Number, required: true },
        getItemKey: { type: Function as PropType<KeyOf>, required: true },
      },
      setup(props) {
        const core = useGridCore<Item>()
        virtual = useGridVirtual(core, props)
        return () => h('div')
      },
    })

    const wrapper = mount(Harness, {
      props: { items, estimateSize: 20, viewportSize: 100, getItemKey: oldKey },
    })
    const initialModel = virtual.model
    initialModel.measure(0, 50)

    expect(initialModel.getState().items).toEqual([
      { index: 0, key: 'old-a', start: 0, size: 50 },
      { index: 1, key: 'old-b', start: 50, size: 20 },
      { index: 2, key: 'old-c', start: 70, size: 20 },
    ])
    expect(initialModel.totalSize()).toBe(90)

    await wrapper.setProps({ getItemKey: newKey })
    await nextTick()

    expect(virtual.model).toBe(initialModel)
    expect(initialModel.getState().items).toEqual([
      { index: 0, key: 'new-a', start: 0, size: 20 },
      { index: 1, key: 'new-b', start: 20, size: 20 },
      { index: 2, key: 'new-c', start: 40, size: 20 },
    ])
    expect(initialModel.totalSize()).toBe(60)
    wrapper.unmount()
  })

  it('syncs the virtualizer count for in-place items growth and shrink', async () => {
    type Item = { id: string }
    const options = reactive<{
      items: Item[]
      estimateSize: number
      viewportSize: number
      buffer: number
      getItemKey: (item: Item, index: number) => string
    }>({
      items: [{ id: 'a' }],
      estimateSize: 20,
      viewportSize: 40,
      buffer: 0,
      getItemKey: (item) => item.id,
    })
    let virtual!: ReturnType<typeof useGridVirtual>
    const Harness = defineComponent({
      setup() {
        const core = useGridCore<Item>()
        virtual = useGridVirtual(core, options)
        return () => h('div')
      },
    })
    const wrapper = mount(Harness)

    expect(virtual.model.totalSize()).toBe(20)

    options.items.push({ id: 'b' }, { id: 'c' })
    await nextTick()
    expect(virtual.model.totalSize()).toBe(60)

    virtual.model.setScroll(40)
    expect(virtual.model.getState().items.map((item) => item.key)).toEqual(['b', 'c'])

    options.items.splice(0, 2)
    await nextTick()
    expect(virtual.model.totalSize()).toBe(20)
    expect(virtual.model.scrollToOffset(40)).toBe(0)
    expect(virtual.model.getState().startIndex).toBe(0)
    expect(virtual.model.getState().items.map((item) => item.key)).toEqual(['c'])

    wrapper.unmount()
  })

  it('forwards replacement virtual range callbacks without recreating the model', async () => {
    type Item = { id: number }
    type RangeCallback = (change: GridVirtualRangeChange) => void
    const items = Array.from({ length: 10 }, (_, id) => ({ id }))
    const oldCallback = vi.fn<RangeCallback>()
    const newCallback = vi.fn<RangeCallback>()
    let core!: GridCore<Item>
    let virtual!: ReturnType<typeof useGridVirtual>

    const Harness = defineComponent({
      props: {
        items: { type: Array as PropType<Item[]>, required: true },
        estimateSize: { type: Number, required: true },
        viewportSize: { type: Number, required: true },
        onRangeChange: Function as PropType<RangeCallback>,
      },
      setup(props) {
        core = useGridCore<Item>()
        virtual = useGridVirtual(core, props)
        return () => h('div')
      },
    })

    const wrapper = mount(Harness, {
      props: { items, estimateSize: 20, viewportSize: 40, onRangeChange: oldCallback },
    })
    const initialModel = virtual.model

    expect(oldCallback).not.toHaveBeenCalled()
    expect(newCallback).not.toHaveBeenCalled()

    await wrapper.setProps({ onRangeChange: newCallback })
    await nextTick()

    expect(oldCallback).not.toHaveBeenCalled()
    expect(newCallback).not.toHaveBeenCalled()
    expect(virtual.model).toBe(initialModel)
    expect(core.invoke('getVirtualModel')).toBe(initialModel)

    initialModel.setScroll(20)

    expect(oldCallback).not.toHaveBeenCalled()
    expect(newCallback).toHaveBeenCalledTimes(1)
    expect(newCallback).toHaveBeenCalledWith({ start: 1, end: 3, totalSize: 200 })

    initialModel.setScroll(20)
    expect(oldCallback).not.toHaveBeenCalled()
    expect(newCallback).toHaveBeenCalledTimes(1)
    wrapper.unmount()
  })

  it('isolates virtual snapshots while preserving scroll windows', async () => {
    let core!: GridCore<{ id: string }>
    let virtual!: ReturnType<typeof useGridVirtual>
    const Harness = defineComponent({
      setup() {
        core = useGridCore<{ id: string }>()
        virtual = useGridVirtual(core, {
          items: Array.from({ length: 5 }, (_, index) => ({ id: String(index) })),
          estimateSize: 20,
          viewportSize: 40,
          buffer: 0,
        })
        return () =>
          h(
            'output',
            { 'data-testid': 'virtual-state' },
            JSON.stringify({
              indexes: virtual.state.value.items.map((item) => item.index),
              totalSize: virtual.state.value.totalSize,
            }),
          )
      },
    })

    const wrapper = mount(Harness)
    const model = virtual.model
    const initial = virtual.state.value
    const internal = model.store.getState()
    const expectWindow = (state: typeof initial, indexes: number[], starts: number[]) => {
      expect(state.totalSize).toBe(100)
      expect(state.items.map((item) => item.index)).toEqual(indexes)
      expect(state.items.map((item) => item.start)).toEqual(starts)
      expect(state.items.every((item) => item.size === 20)).toBe(true)
    }

    expect(model).toBe(core.invoke('getVirtualModel'))
    expect(initial).not.toBe(internal)
    expect(initial.items).not.toBe(internal.items)
    expect(initial.items[0]).not.toBe(internal.items[0])
    expectWindow(initial, [0, 1], [0, 20])
    expect(wrapper.get('[data-testid="virtual-state"]').text()).toBe(
      JSON.stringify({ indexes: [0, 1], totalSize: 100 }),
    )

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
    await nextTick()
    expectWindow(virtual.state.value, [1, 2], [20, 40])
    expect(wrapper.get('[data-testid="virtual-state"]').text()).toBe(
      JSON.stringify({ indexes: [1, 2], totalSize: 100 }),
    )

    const emitted = virtual.state.value
    emitted.offsetBefore = 999
    emitted.totalSize = 999
    emitted.items[0]!.start = 999
    emitted.items.length = 0
    expectWindow(model.store.getState(), [1, 2], [20, 40])
    expectWindow(model.getState(), [1, 2], [20, 40])

    model.setScroll(40)
    await nextTick()
    expectWindow(virtual.state.value, [2, 3], [40, 60])
    expect(wrapper.get('[data-testid="virtual-state"]').text()).toBe(
      JSON.stringify({ indexes: [2, 3], totalSize: 100 }),
    )
    wrapper.unmount()
  })
})
