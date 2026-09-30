import { defineComponent, h, nextTick, type PropType } from 'vue'
import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { type GridRowsModel } from '@iris-ui-kit/core/grid'
import { useGridCore, useGridRows, useGridSelection, useGridVirtual } from './index'

describe('Vue Grid vue grid rows', () => {
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

  it('uses replacement tree callbacks without recreating the rows model', async () => {
    type TreeRow = {
      id: number
      name: string
      a?: TreeRow[]
      b?: TreeRow[]
    }
    type TreeOptions = {
      getChildren: (row: TreeRow) => readonly TreeRow[] | undefined
      setChildren: (row: TreeRow, children: TreeRow[]) => TreeRow
    }
    const initialRows: TreeRow[] = [
      {
        id: 1,
        name: 'Root',
        a: [{ id: 2, name: 'A' }],
        b: [{ id: 3, name: 'B' }],
      },
    ]
    const getChildrenA = vi.fn((row: TreeRow) => row.a)
    const getChildrenB = vi.fn((row: TreeRow) => row.b)
    const setChildrenA = vi.fn((row: TreeRow, children: TreeRow[]) => ({ ...row, a: children }))
    const setChildrenB = vi.fn((row: TreeRow, children: TreeRow[]) => ({ ...row, b: children }))
    let bridge!: { model: GridRowsModel<TreeRow> }
    const Harness = defineComponent({
      props: {
        getChildren: Function as PropType<TreeOptions['getChildren']>,
        setChildren: Function as PropType<TreeOptions['setChildren']>,
      },
      setup(props) {
        const core = useGridCore<TreeRow>()
        bridge = useGridRows(core, initialRows, props)
        return () => h('div')
      },
    })

    const wrapper = mount(Harness, {
      props: { getChildren: getChildrenA, setChildren: setChildrenA },
    })
    const model = bridge.model
    getChildrenA.mockClear()
    setChildrenA.mockClear()

    await wrapper.setProps({ getChildren: getChildrenB, setChildren: setChildrenA })
    await nextTick()
    expect(bridge.model).toBe(model)
    expect(model.find(3)).toMatchObject({ id: 3, name: 'B' })
    expect(model.find(2)).toBeUndefined()
    expect(getChildrenA).not.toHaveBeenCalled()
    getChildrenB.mockClear()
    setChildrenA.mockClear()

    await wrapper.setProps({ getChildren: getChildrenB, setChildren: setChildrenB })
    await nextTick()

    expect(bridge.model).toBe(model)
    expect(model.find(3)).toMatchObject({ id: 3, name: 'B' })
    expect(model.find(2)).toBeUndefined()
    expect(getChildrenA).not.toHaveBeenCalled()

    expect(model.update(3, { name: 'Updated' })).toBe(true)
    expect(model.find(3)).toMatchObject({ id: 3, name: 'Updated' })
    expect(setChildrenB).toHaveBeenCalledOnce()
    expect(setChildrenA).not.toHaveBeenCalled()

    const replacement = [{ id: 4, name: 'Replacement' }]
    expect(model.setChildren(1, replacement)).toBe(true)
    expect(model.get()[0]?.b).toEqual(replacement)
    expect(setChildrenB).toHaveBeenCalledTimes(2)
    expect(setChildrenA).not.toHaveBeenCalled()
    expect(getChildrenA).not.toHaveBeenCalled()
    wrapper.unmount()
  })
})
