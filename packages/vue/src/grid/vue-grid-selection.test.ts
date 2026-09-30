import { defineComponent, h, nextTick, reactive, type PropType } from 'vue'
import { type Store } from '@iris-ui-kit/core'
import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import {
  GRID_SELECTION_CHANGE_EVENT,
  type GridColumnsModel,
  type GridCore,
} from '@iris-ui-kit/core/grid'
import { useGridColumns, useGridCore, useGridRows, useGridSelection } from './index'

describe('Vue Grid vue grid selection', () => {
  it('preserves a batched uncontrolled selection across controlled handoff release', async () => {
    const onChange = vi.fn()
    const selectionEvent = vi.fn()
    const options = reactive({
      value: undefined as string[] | undefined,
      defaultValue: ['a'],
      onChange,
    })
    let core!: GridCore
    let selection!: ReturnType<typeof useGridSelection>
    const Harness = defineComponent({
      setup() {
        core = useGridCore()
        selection = useGridSelection(core, options)
        return () =>
          h('output', { 'data-testid': 'selection' }, JSON.stringify(selection.selection.value))
      },
    })

    const wrapper = mount(Harness)
    core.on(GRID_SELECTION_CHANGE_EVENT, selectionEvent)
    const store = selection.model.store as unknown as Store<string[]>

    store.batch(() => {
      selection.model.set(['b'])
      options.value = ['c']
    })
    await nextTick()

    expect(selection.selection.value).toEqual(['c'])
    expect(selection.model.get()).toEqual(['c'])
    expect(selection.model.store.getState()).toEqual(['c'])
    expect(wrapper.get('[data-testid="selection"]').text()).toBe('["c"]')
    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange).toHaveBeenCalledWith(['b'])
    expect(selectionEvent).toHaveBeenCalledTimes(1)
    expect(selectionEvent).toHaveBeenCalledWith({ selectedKeys: ['b'] })
    const countsBeforeRelease = {
      onChange: onChange.mock.calls.length,
      selectionEvent: selectionEvent.mock.calls.length,
    }

    options.value = undefined
    await nextTick()

    expect(selection.selection.value).toEqual(['b'])
    expect(selection.model.get()).toEqual(['b'])
    expect(selection.model.store.getState()).toEqual(['b'])
    expect(wrapper.get('[data-testid="selection"]').text()).toBe('["b"]')
    expect(onChange).toHaveBeenCalledTimes(countsBeforeRelease.onChange)
    expect(selectionEvent).toHaveBeenCalledTimes(countsBeforeRelease.selectionEvent)
    wrapper.unmount()
  })

  it('rebases rejected controlled selection before synchronous toggles', () => {
    const onChange = vi.fn()
    let selection!: ReturnType<typeof useGridSelection>
    const Harness = defineComponent({
      props: {
        mode: {
          type: String as PropType<'single' | 'multiple'>,
          default: 'multiple',
        },
        value: Array as PropType<string[]>,
        onChange: Function as PropType<(keys: string[]) => void>,
      },
      setup(props) {
        const core = useGridCore()
        selection = useGridSelection(core, props)
        return () =>
          h('output', { 'data-testid': 'selection' }, JSON.stringify(selection.selection.value))
      },
    })

    const wrapper = mount(Harness, {
      props: { mode: 'multiple', value: ['a'], onChange },
    })
    expect(selection.selection.value).toEqual(['a'])
    expect(onChange).not.toHaveBeenCalled()

    selection.rebase()
    expect(onChange).not.toHaveBeenCalled()
    selection.model.toggle('b')
    selection.rebase()
    expect(onChange).toHaveBeenCalledTimes(1)
    selection.model.toggle('c')

    expect(onChange.mock.calls.map(([keys]) => keys)).toEqual([
      ['a', 'b'],
      ['a', 'c'],
    ])
    expect(onChange.mock.calls.map(([keys]) => keys)).not.toContainEqual(['a', 'b', 'c'])
    expect(selection.selection.value).toEqual(['a'])
    expect(wrapper.get('[data-testid="selection"]').text()).toBe('["a"]')
    wrapper.unmount()
  })

  it('installs columns on the supplied core and keeps inbound sync silent', () => {
    let core: GridCore<{ id: string }> | undefined
    let columns: ReturnType<typeof useGridColumns> | undefined
    const onVisibilityChange = vi.fn()
    const onWidthsChange = vi.fn()
    const Harness = defineComponent({
      setup() {
        core = useGridCore<{ id: string }>()
        useGridRows(core, [{ id: 'a' }])
        useGridSelection(core, { defaultValue: ['a'] })
        columns = useGridColumns(core, { onVisibilityChange, onWidthsChange })
        return () => h('div')
      },
    })

    const wrapper = mount(Harness)
    const feature = columns!
    expect(core!.features.filter((name) => name === 'columns')).toHaveLength(1)
    expect(feature.model).toBe(core!.invoke<GridColumnsModel>('getColumnsModel'))

    feature.model.syncVisibility({ hidden: false })
    feature.model.syncWidths({ name: 120 })
    expect(onVisibilityChange).not.toHaveBeenCalled()
    expect(onWidthsChange).not.toHaveBeenCalled()

    feature.setWidths({ name: 140 })
    feature.setVisibility({ hidden: true })
    expect(onWidthsChange).toHaveBeenCalledWith({ name: 140 })
    expect(onVisibilityChange).toHaveBeenCalledWith({ hidden: true })

    wrapper.unmount()
    expect(core!.status).toBe('destroyed')
  })
})
