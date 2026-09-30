import { defineComponent, h, nextTick, reactive } from 'vue'
import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import {
  GRID_VIRTUAL_RANGE_CHANGE_EVENT,
  type GridCore,
  type GridVirtualRangeChange,
} from '@iris-ui-kit/core/grid'
import { useGridCore, useGridVirtual } from './index'

describe('Vue Grid Core bridge — virtual same-count item replacement', () => {
  type Item = { id: string; label?: string }

  const mountVirtual = () => {
    const options = reactive<{
      items: Item[]
      estimateSize: number
      viewportSize: number
      getItemKey: (item: Item, index: number) => string
    }>({
      items: [{ id: 'a' }, { id: 'b' }, { id: 'c' }],
      estimateSize: 20,
      viewportSize: 100,
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
    return { options, virtual, wrapper }
  }

  it('re-seats keyed measurements when an item is replaced in place at the same count', async () => {
    const { options, virtual, wrapper } = mountVirtual()
    virtual.model.measure(0, 100)
    expect(virtual.model.totalSize()).toBe(140)

    options.items[0] = { id: 'z' }
    await nextTick()

    expect(virtual.model.getState().items[0]).toEqual({ index: 0, key: 'z', start: 0, size: 20 })
    expect(virtual.model.totalSize()).toBe(60)
    wrapper.unmount()
  })

  it('re-seats after a same-count splice replacement', async () => {
    const { options, virtual, wrapper } = mountVirtual()
    virtual.model.measure(0, 100)

    options.items.splice(0, 1, { id: 'z' })
    await nextTick()

    expect(virtual.model.getState().items[0]).toEqual({ index: 0, key: 'z', start: 0, size: 20 })
    expect(virtual.model.totalSize()).toBe(60)
    wrapper.unmount()
  })

  it('does not fire the identity watcher for a non-key field mutation', async () => {
    const { options, virtual, wrapper } = mountVirtual()
    virtual.model.measure(0, 100)
    const setCount = vi.spyOn(virtual.model, 'setCount')

    options.items[0]!.label = 'x'
    await nextTick()

    expect(setCount).not.toHaveBeenCalled()
    expect(virtual.model.getState().items[0]).toEqual({ index: 0, key: 'a', start: 0, size: 100 })
    expect(virtual.model.totalSize()).toBe(140)
    wrapper.unmount()
  })

  it('keeps a same-key identity change inert (no state move, no range event)', async () => {
    const options = reactive<{
      items: Item[]
      estimateSize: number
      viewportSize: number
      getItemKey: (item: Item, index: number) => string
    }>({
      items: [{ id: 'a' }, { id: 'b' }, { id: 'c' }],
      estimateSize: 20,
      viewportSize: 100,
      getItemKey: (item) => item.id,
    })
    let core!: GridCore<Item>
    let virtual!: ReturnType<typeof useGridVirtual>
    const Harness = defineComponent({
      setup() {
        core = useGridCore<Item>()
        virtual = useGridVirtual(core, options)
        return () => h('div')
      },
    })
    const wrapper = mount(Harness)
    virtual.model.measure(0, 100)
    const events: GridVirtualRangeChange[] = []
    core.on<GridVirtualRangeChange>(GRID_VIRTUAL_RANGE_CHANGE_EVENT, (change) =>
      events.push(change),
    )
    const setCount = vi.spyOn(virtual.model, 'setCount')

    options.items[0] = { id: 'a' } // new object, same key
    await nextTick()

    expect(setCount).toHaveBeenCalledTimes(1)
    expect(virtual.model.getState().items[0]).toEqual({ index: 0, key: 'a', start: 0, size: 100 })
    expect(virtual.model.totalSize()).toBe(140)
    expect(events).toEqual([])
    wrapper.unmount()
  })
})
