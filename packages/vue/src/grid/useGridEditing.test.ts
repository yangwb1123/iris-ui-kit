import { defineComponent, h, nextTick } from 'vue'
import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { GRID_EDITING_CHANGE_EVENT, type GridCore } from '@iris-ui-kit/core/grid'
import { useGridCore, useGridEditing, useGridRows } from './index'

type Row = { id: number; name: string }

describe('useGridEditing', () => {
  it('isolates mutable bridge snapshots from Core editing state', async () => {
    const onStateChange = vi.fn()
    const storeObserver = vi.fn()
    const eventObserver = vi.fn()
    let editing!: ReturnType<typeof useGridEditing<Row>>
    const Harness = defineComponent({
      setup() {
        const core = useGridCore<Row>()
        useGridRows(core, [{ id: 1, name: 'Ada' }])
        editing = useGridEditing(core, {
          getRowKey: (row) => row.id,
          onStateChange,
        })
        return () => h('div')
      },
    })

    const wrapper = mount(Harness)
    const unsubscribeStore = editing.model.store.subscribe(storeObserver)
    const unsubscribeEvent = editing.core.on(GRID_EDITING_CHANGE_EVENT, eventObserver)
    expect(editing.state.value.editing).toBeNull()

    expect(editing.startCellEdit(1, 'name')).toBe(true)
    await nextTick()
    const snapshot = editing.state.value
    const coreState = editing.model.store.getState()
    expect(snapshot).not.toBe(coreState)
    expect(snapshot.editing).not.toBe(coreState.editing)

    const counts = {
      store: storeObserver.mock.calls.length,
      state: onStateChange.mock.calls.length,
      event: eventObserver.mock.calls.length,
    }
    snapshot.error = 'locally mutated'
    snapshot.editing!.rowKey = 'locally mutated'

    expect(editing.model.getState()).toMatchObject({
      editing: { rowKey: 1, columnKey: 'name' },
      error: null,
    })
    expect(editing.model.store.getState()).toMatchObject({
      editing: { rowKey: 1, columnKey: 'name' },
      error: null,
    })
    expect(editing.isCellEditing(1, 'name')).toBe(true)
    expect(storeObserver).toHaveBeenCalledTimes(counts.store)
    expect(onStateChange).toHaveBeenCalledTimes(counts.state)
    expect(eventObserver).toHaveBeenCalledTimes(counts.event)

    editing.setCellDraft('Grace')
    await nextTick()
    const fresh = editing.state.value
    expect(fresh).not.toBe(snapshot)
    expect(fresh).toMatchObject({
      editing: { rowKey: 1, columnKey: 'name' },
      draft: 'Grace',
      error: null,
    })

    unsubscribeStore()
    unsubscribeEvent()
    wrapper.unmount()
  })

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
