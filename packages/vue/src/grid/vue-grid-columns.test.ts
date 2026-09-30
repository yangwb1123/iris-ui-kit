import { defineComponent, h, nextTick, type PropType } from 'vue'
import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import {
  GRID_COLUMNS_CHANGE_EVENT,
  type GridColumnsChange,
  type GridCore,
} from '@iris-ui-kit/core/grid'
import { useGridColumns, useGridCore } from './index'

describe('Vue Grid vue grid columns', () => {
  it('rebases rejected controlled column proposals from accepted props', async () => {
    let core!: GridCore
    let columns!: ReturnType<typeof useGridColumns>
    const accepted = {
      visibility: { hidden: false },
      order: ['name'],
      widths: { name: 310, age: 260 },
      pinned: { name: 'right' as const, age: 'left' as const },
    }
    const onVisibilityChange = vi.fn()
    const onOrderChange = vi.fn()
    const onWidthsChange = vi.fn()
    const onPinnedChange = vi.fn()
    const events: GridColumnsChange[] = []
    const Harness = defineComponent({
      props: {
        visibility: Object as PropType<Record<string, boolean>>,
        order: Array as PropType<string[]>,
        orderControlled: { type: Boolean, default: undefined },
        widths: Object as PropType<Record<string, number>>,
        pinned: Object as PropType<Record<string, 'left' | 'right' | null>>,
        onVisibilityChange: Function as PropType<(value: Record<string, boolean>) => void>,
        onOrderChange: Function as PropType<(value: string[] | undefined) => void>,
        onWidthsChange: Function as PropType<(value: Record<string, number>) => void>,
        onPinnedChange: Function as PropType<(key: string, side: 'left' | 'right' | null) => void>,
      },
      setup(props) {
        core = useGridCore()
        columns = useGridColumns(core, props)
        return () =>
          h('output', { 'data-testid': 'column-state' }, JSON.stringify(columns.state.value))
      },
    })
    const wrapper = mount(Harness, {
      props: {
        ...accepted,
        onVisibilityChange,
        onOrderChange,
        onWidthsChange,
        onPinnedChange,
      },
    })
    core.on(GRID_COLUMNS_CHANGE_EVENT, (event) => events.push(event))

    const expectAccepted = (): void => {
      expect(columns.state.value).toEqual(accepted)
      expect(columns.model.get()).toEqual(accepted)
      expect(columns.model.store.getState()).toEqual(accepted)
    }
    const expectRejected = async (proposal: () => void): Promise<void> => {
      proposal()
      expectAccepted()
      expect(wrapper.get('[data-testid="column-state"]').text()).toBe(JSON.stringify(accepted))
      await nextTick()
      expectAccepted()
      expect(wrapper.get('[data-testid="column-state"]').text()).toBe(JSON.stringify(accepted))
    }

    expectAccepted()
    await expectRejected(() => columns.setVisibility({ hidden: true }))
    await expectRejected(() => columns.setOrder(['age', 'name']))
    await expectRejected(() => columns.setWidths({ name: 120 }))
    await expectRejected(() => columns.setWidth('age', 140))
    await expectRejected(() => columns.resetWidths())
    await expectRejected(() => columns.setPinned('name', null))
    await expectRejected(() => columns.clearOrder())

    expect(onVisibilityChange).toHaveBeenCalledWith({ hidden: true })
    expect(onOrderChange.mock.calls).toEqual([[['age', 'name']], [undefined]])
    expect(onWidthsChange.mock.calls).toEqual([[{ name: 120 }], [{ name: 310, age: 140 }], [{}]])
    expect(onPinnedChange).toHaveBeenCalledWith('name', null)
    expect(events).toEqual([
      { channel: 'visibility', visibility: { hidden: true } },
      { channel: 'order', order: ['age', 'name'] },
      { channel: 'widths', widths: { name: 120 } },
      { channel: 'widths', widths: { name: 310, age: 140 } },
      { channel: 'widths', widths: {} },
      {
        channel: 'pinned',
        key: 'name',
        side: null,
        pinned: { name: null, age: 'left' },
      },
      { channel: 'order', order: undefined },
    ])
    expect(accepted).toEqual({
      visibility: { hidden: false },
      order: ['name'],
      widths: { name: 310, age: 260 },
      pinned: { name: 'right', age: 'left' },
    })
    wrapper.unmount()
  })

  it('rebases controlled column proposals before a batched store notification', () => {
    const onOrderChange = vi.fn()
    const acceptedOrder = ['name']
    let columns!: ReturnType<typeof useGridColumns>
    const Harness = defineComponent({
      props: {
        order: Array as PropType<string[]>,
        onOrderChange: Function as PropType<(value: string[] | undefined) => void>,
      },
      setup(props) {
        const core = useGridCore()
        columns = useGridColumns(core, props)
        return () => h('div')
      },
    })

    const wrapper = mount(Harness, { props: { order: acceptedOrder, onOrderChange } })
    columns.model.store.batch(() => {
      columns.setOrder(['age'])
      expect(columns.model.get().order).toEqual(acceptedOrder)
      expect(columns.model.store.getState().order).toEqual(acceptedOrder)
    })
    expect(columns.state.value.order).toEqual(acceptedOrder)
    expect(onOrderChange).toHaveBeenCalledOnce()
    expect(onOrderChange).toHaveBeenCalledWith(['age'])
    wrapper.unmount()
  })

  it('treats an explicitly controlled empty order as authoritative', async () => {
    const onOrderChange = vi.fn()
    let columns!: ReturnType<typeof useGridColumns>
    const Harness = defineComponent({
      props: {
        order: Array as PropType<string[]>,
        orderControlled: { type: Boolean, default: undefined },
        defaultOrder: Array as PropType<string[]>,
        onOrderChange: Function as PropType<(value: string[] | undefined) => void>,
      },
      setup(props) {
        const core = useGridCore()
        columns = useGridColumns(core, props)
        return () => h('output', JSON.stringify(columns.state.value.order))
      },
    })

    const wrapper = mount(Harness, {
      props: { orderControlled: true, defaultOrder: ['name'], onOrderChange },
    })
    expect(columns.state.value.order).toEqual([])
    expect(columns.model.get().order).toEqual([])
    columns.setOrder(['age'])
    expect(columns.state.value.order).toEqual([])
    expect(columns.model.get().order).toEqual([])
    columns.clearOrder()
    await nextTick()
    expect(columns.state.value.order).toEqual([])
    expect(columns.model.store.getState().order).toEqual([])
    expect(onOrderChange.mock.calls).toEqual([[['age']], [undefined]])
    wrapper.unmount()
  })

  it('keeps accepted column updates and independent snapshots across rejected handoffs', async () => {
    const uncontrolled = {
      visibility: { hidden: false },
      order: ['age', 'name'],
      widths: { name: 116, age: 216 },
      pinned: { name: null as const, age: 'right' as const },
    }
    const acceptedA = {
      visibility: { hidden: false },
      order: ['name'],
      widths: { name: 310, age: 260 },
      pinned: { name: 'right' as const, age: 'left' as const },
    }
    const acceptedB = {
      visibility: { hidden: true },
      order: ['age'],
      widths: { name: 400, age: 280 },
      pinned: { name: 'left' as const, age: null as const },
    }
    const onVisibilityChange = vi.fn()
    const onOrderChange = vi.fn()
    const onWidthsChange = vi.fn()
    const onPinnedChange = vi.fn()
    let columns!: ReturnType<typeof useGridColumns>
    const Harness = defineComponent({
      props: {
        visibility: Object as PropType<Record<string, boolean>>,
        order: Array as PropType<string[]>,
        widths: Object as PropType<Record<string, number>>,
        pinned: Object as PropType<Record<string, 'left' | 'right' | null>>,
        defaultVisibility: Object as PropType<Record<string, boolean>>,
        defaultOrder: Array as PropType<string[]>,
        defaultWidths: Object as PropType<Record<string, number>>,
        defaultPinned: Object as PropType<Record<string, 'left' | 'right' | null>>,
        onVisibilityChange: Function as PropType<(value: Record<string, boolean>) => void>,
        onOrderChange: Function as PropType<(value: string[] | undefined) => void>,
        onWidthsChange: Function as PropType<(value: Record<string, number>) => void>,
        onPinnedChange: Function as PropType<(key: string, side: 'left' | 'right' | null) => void>,
      },
      setup(props) {
        const core = useGridCore()
        columns = useGridColumns(core, props)
        return () => h('div')
      },
    })
    const wrapper = mount(Harness, {
      props: {
        defaultVisibility: { hidden: true },
        defaultOrder: ['name', 'age'],
        defaultWidths: { name: 100, age: 200 },
        defaultPinned: { name: 'left', age: 'right' },
        onVisibilityChange,
        onOrderChange,
        onWidthsChange,
        onPinnedChange,
      },
    })

    columns.setVisibility(uncontrolled.visibility)
    columns.setOrder(uncontrolled.order)
    columns.setWidths(uncontrolled.widths)
    columns.setPinned('name', uncontrolled.pinned.name)
    const localCallbackCounts = {
      visibility: onVisibilityChange.mock.calls.length,
      order: onOrderChange.mock.calls.length,
      widths: onWidthsChange.mock.calls.length,
      pinned: onPinnedChange.mock.calls.length,
    }

    await wrapper.setProps(acceptedA)
    await nextTick()
    expect(columns.model.get()).toEqual(acceptedA)
    expect(columns.state.value).toEqual(acceptedA)
    expect(onVisibilityChange).toHaveBeenCalledTimes(localCallbackCounts.visibility)
    expect(onOrderChange).toHaveBeenCalledTimes(localCallbackCounts.order)
    expect(onWidthsChange).toHaveBeenCalledTimes(localCallbackCounts.widths)
    expect(onPinnedChange).toHaveBeenCalledTimes(localCallbackCounts.pinned)

    await wrapper.setProps(acceptedB)
    await nextTick()
    expect(columns.model.get()).toEqual(acceptedB)
    expect(columns.state.value).toEqual(acceptedB)
    const acceptedCallbackCounts = {
      visibility: onVisibilityChange.mock.calls.length,
      order: onOrderChange.mock.calls.length,
      widths: onWidthsChange.mock.calls.length,
      pinned: onPinnedChange.mock.calls.length,
    }

    columns.setVisibility({ hidden: false })
    columns.setOrder(['rejected'])
    columns.setWidths({ name: 1 })
    columns.setWidth('age', 140)
    expect(onWidthsChange).toHaveBeenLastCalledWith({ name: 400, age: 140 })
    columns.resetWidths()
    columns.setPinned('name', null)
    columns.clearOrder()
    expect(columns.model.get()).toEqual(acceptedB)
    expect(columns.state.value).toEqual(acceptedB)
    expect(onVisibilityChange.mock.calls.length).toBeGreaterThan(acceptedCallbackCounts.visibility)
    expect(onOrderChange.mock.calls.length).toBeGreaterThan(acceptedCallbackCounts.order)
    expect(onWidthsChange.mock.calls.length).toBeGreaterThan(acceptedCallbackCounts.widths)
    expect(onPinnedChange.mock.calls.length).toBeGreaterThan(acceptedCallbackCounts.pinned)

    expect(acceptedA).toEqual({
      visibility: { hidden: false },
      order: ['name'],
      widths: { name: 310, age: 260 },
      pinned: { name: 'right', age: 'left' },
    })
    expect(acceptedB).toEqual({
      visibility: { hidden: true },
      order: ['age'],
      widths: { name: 400, age: 280 },
      pinned: { name: 'left', age: null },
    })

    const handoffCallbackCounts = {
      visibility: onVisibilityChange.mock.calls.length,
      order: onOrderChange.mock.calls.length,
      widths: onWidthsChange.mock.calls.length,
      pinned: onPinnedChange.mock.calls.length,
    }
    await wrapper.setProps({
      visibility: undefined,
      order: undefined,
      widths: undefined,
      pinned: undefined,
    })
    await nextTick()
    expect(columns.model.get()).toEqual(uncontrolled)
    expect(columns.model.store.getState()).toEqual(uncontrolled)
    expect(columns.state.value).toEqual(uncontrolled)
    expect(onVisibilityChange).toHaveBeenCalledTimes(handoffCallbackCounts.visibility)
    expect(onOrderChange).toHaveBeenCalledTimes(handoffCallbackCounts.order)
    expect(onWidthsChange).toHaveBeenCalledTimes(handoffCallbackCounts.widths)
    expect(onPinnedChange).toHaveBeenCalledTimes(handoffCallbackCounts.pinned)
    wrapper.unmount()
  })
})
