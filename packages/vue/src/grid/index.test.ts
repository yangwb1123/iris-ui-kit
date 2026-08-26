import { defineComponent, h, nextTick } from 'vue'
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { useGridCore, useGridRows, useGridSelection, useGridVirtual } from './index'

describe('Vue Grid Core bridge', () => {
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
