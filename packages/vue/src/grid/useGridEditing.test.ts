import { defineComponent, h, nextTick } from 'vue'
import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import type { GridCore } from '@iris-ui-kit/core/grid'
import { useGridCore, useGridEditing, useGridRows } from './index'

type Row = { id: number; name: string }

describe('useGridEditing', () => {
  it('shares rows, updates the Vue ref, and forwards the commit transaction', async () => {
    let core: GridCore<Row> | undefined
    let transaction: { reason: string; meta: unknown } | undefined
    const onCommit = vi.fn()
    const Harness = defineComponent({
      setup() {
        core = useGridCore<Row>()
        const rows = useGridRows(core, [{ id: 1, name: 'Ada' }], {
          onRowsChange: (next) => {
            transaction = next
          },
        })
        const editing = useGridEditing(core, {
          getRowKey: (row) => row.id,
          onCommit,
          commitOptions: { meta: { source: 'vue-test' } },
        })
        return () =>
          h('div', [
            h('span', { 'data-testid': 'state' }, JSON.stringify(editing.state.value)),
            h('span', { 'data-testid': 'row' }, rows.rows.value[0]?.name),
            h(
              'button',
              {
                onClick: () => {
                  editing.startCellEdit(1, 'name')
                  editing.setCellDraft('Grace')
                  editing.commitCellEdit()
                },
              },
              'commit',
            ),
          ])
      },
    })

    const wrapper = mount(Harness)
    await wrapper.get('button').trigger('click')
    await nextTick()

    expect(wrapper.get('[data-testid="row"]').text()).toBe('Grace')
    expect(wrapper.get('[data-testid="state"]').text()).toContain('"editing":null')
    expect(transaction).toMatchObject({ reason: 'cell-edit', meta: { source: 'vue-test' } })
    expect(onCommit).toHaveBeenCalledWith(
      expect.objectContaining({ rowKey: 1, columnKey: 'name', value: 'Grace' }),
    )
    expect(core?.hasFeature('editing')).toBe(true)
    wrapper.unmount()
  })
})
