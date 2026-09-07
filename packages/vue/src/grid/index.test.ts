import { defineComponent, h, nextTick, type PropType } from 'vue'
import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import type { GridColumnsModel, GridCore } from '@iris-ui-kit/core/grid'
import { useGridColumns, useGridCore, useGridRows, useGridSelection, useGridVirtual } from './index'

describe('Vue Grid Core bridge', () => {
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

  it('restores the uncontrolled visibility snapshot across rejected control handoff', async () => {
    const Harness = defineComponent({
      props: {
        visibility: Object as PropType<Record<string, boolean>>,
        defaultVisibility: Object as PropType<Record<string, boolean>>,
      },
      setup(props) {
        const core = useGridCore()
        const columns = useGridColumns(core, props)
        return () =>
          h(
            'button',
            { onClick: () => columns.toggleVisibility('age') },
            String(columns.state.value.visibility.age),
          )
      },
    })

    const wrapper = mount(Harness, {
      props: { visibility: { age: false }, defaultVisibility: { age: false } },
    })
    expect(wrapper.text()).toBe('false')

    await wrapper.get('button').trigger('click')
    expect(wrapper.text()).toBe('false')

    await wrapper.setProps({ visibility: undefined })
    await nextTick()
    expect(wrapper.text()).toBe('false')

    await wrapper.setProps({ visibility: { age: true } })
    await nextTick()
    expect(wrapper.text()).toBe('true')
    await wrapper.setProps({ visibility: undefined })
    await nextTick()
    expect(wrapper.text()).toBe('false')
    wrapper.unmount()
  })

  it('isolates all column snapshots and restores each uncontrolled channel after handoff', async () => {
    let columns: ReturnType<typeof useGridColumns> | undefined
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
      },
      setup(props) {
        const core = useGridCore()
        columns = useGridColumns(core, props)
        return () => h('output', JSON.stringify(columns!.state.value))
      },
    })
    const controlled = {
      visibility: { age: false },
      order: ['name'],
      widths: { name: 310 },
      pinned: { name: 'right' as const },
    }
    const wrapper = mount(Harness, {
      props: {
        defaultVisibility: { age: false },
        defaultOrder: ['name', 'age'],
        defaultWidths: { name: 100 },
        defaultPinned: { name: 'left' },
      },
    })

    columns!.setVisibility({ age: true })
    columns!.setOrder(['age', 'name'])
    columns!.setWidths({ name: 116 })
    columns!.setPinned('name', null)
    expect(columns!.model.get()).toMatchObject({
      visibility: { age: true },
      order: ['age', 'name'],
      widths: { name: 116 },
      pinned: { name: null },
    })

    await wrapper.setProps(controlled)
    expect(columns!.model.get()).toMatchObject(controlled)
    columns!.state.value.visibility.age = true
    columns!.state.value.order.push('mutated')
    columns!.state.value.widths.name = 999
    columns!.state.value.pinned.name = 'left'
    expect(columns!.model.get()).toMatchObject(controlled)

    controlled.visibility.age = true
    controlled.order.push('mutated-input')
    controlled.widths.name = 998
    controlled.pinned.name = 'left'
    expect(columns!.model.get()).toMatchObject({
      visibility: { age: false },
      order: ['name'],
      widths: { name: 310 },
      pinned: { name: 'right' },
    })

    await wrapper.setProps({
      visibility: undefined,
      order: undefined,
      widths: undefined,
      pinned: undefined,
    })
    await nextTick()
    expect(columns!.model.get()).toMatchObject({
      visibility: { age: true },
      order: ['age', 'name'],
      widths: { name: 116 },
      pinned: { name: null },
    })
    wrapper.unmount()
  })

  it('uses one core instance for rows + selection and destroys it with the component', async () => {
    let coreStatus = ''
    const Harness = defineComponent({
      setup() {
        const core = useGridCore<{ id: string }>({})
        const rows = useGridRows(core, [{ id: 'a' }, { id: 'b' }])
        const selection = useGridSelection(core, { defaultValue: ['a'] })
        const virtual = useGridVirtual(core, {
          items: rows.rows.value,
          estimateSize: 20,
          viewportSize: 20,
          getItemKey: (item) => item.id,
        })
        coreStatus = core.status
        return () =>
          h(
            'button',
            { onClick: () => selection.model.toggle('b') },
            `${rows.rows.value.length}:${selection.selection.value.join(',')}:${virtual.state.value.totalSize}`,
          )
      },
    })

    const wrapper = mount(Harness)
    expect(wrapper.text()).toBe('2:a:40')
    await wrapper.trigger('click')
    await nextTick()
    expect(wrapper.text()).toBe('2:a,b:40')
    expect(coreStatus).toBe('created')
    wrapper.unmount()
  })

  it('routes nested row mutations through tree accessors', async () => {
    type TreeRow = { id: number; name: string; children?: TreeRow[] }
    const Harness = defineComponent({
      setup() {
        const core = useGridCore<TreeRow>({})
        const rows = useGridRows(
          core,
          [{ id: 1, name: 'Root', children: [{ id: 2, name: 'Child' }] }],
          { getChildren: (row) => row.children },
        )
        return () =>
          h('div', [
            h('span', { 'data-testid': 'tree-child' }, rows.rows.value[0]?.children?.[0]?.name),
            h(
              'button',
              { onClick: () => rows.model.update(2, { name: 'Updated' }) },
              'update nested',
            ),
            h('button', { onClick: () => rows.model.remove(2) }, 'remove nested'),
          ])
      },
    })

    const wrapper = mount(Harness)
    await wrapper.get('button').trigger('click')
    await nextTick()
    expect(wrapper.get('[data-testid="tree-child"]').text()).toBe('Updated')
    await wrapper.get('button:nth-of-type(2)').trigger('click')
    await nextTick()
    expect(wrapper.get('[data-testid="tree-child"]').text()).toBe('')
    wrapper.unmount()
  })
})
