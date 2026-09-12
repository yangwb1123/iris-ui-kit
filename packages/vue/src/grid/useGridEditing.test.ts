import { defineComponent, h, nextTick } from 'vue'
import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import {
  GRID_EDITING_CHANGE_EVENT,
  type GridCore,
  type GridEditingCommit,
} from '@iris-ui-kit/core/grid'
import { useGridCore, useGridEditing, useGridRows } from './index'

type Row = { id: number; name: string }
type AmountRow = { id: number; amount: number | null | string }

describe('useGridEditing', () => {
  it('preserves explicit getValue results and falls back only when omitted', () => {
    type Scenario = {
      getValue?: (row: AmountRow, columnKey: string) => unknown
      coerce?: (draft: unknown, row: AmountRow, columnKey: string) => unknown
      expectedInitial: unknown
      draft: unknown
      expectedOldValue: unknown
      expectedValue: unknown
    }

    const runScenario = (scenario: Scenario) => {
      const onCommit = vi.fn<(commit: GridEditingCommit<AmountRow>) => void>()
      let rows!: ReturnType<typeof useGridRows<AmountRow>>
      let editing!: ReturnType<typeof useGridEditing<AmountRow>>
      const Harness = defineComponent({
        setup() {
          const core = useGridCore<AmountRow>()
          rows = useGridRows(core, [{ id: 1, amount: 7 }])
          editing = useGridEditing(core, {
            getRowKey: (row) => row.id,
            ...(scenario.getValue ? { getValue: scenario.getValue } : {}),
            ...(scenario.coerce ? { coerce: scenario.coerce } : {}),
            onCommit,
          })
          return () => h('div')
        },
      })

      const wrapper = mount(Harness)
      expect(editing.startCellEdit(1, 'amount')).toBe(true)
      expect(editing.model.getDraft()).toBe(scenario.expectedInitial)
      editing.setCellDraft(scenario.draft)
      expect(editing.commitCellEdit()).toBe(true)
      expect(onCommit).toHaveBeenCalledTimes(1)
      const commit = onCommit.mock.calls[0]![0]
      expect(commit.oldValue).toBe(scenario.expectedOldValue)
      expect(commit.value).toBe(scenario.expectedValue)
      expect(commit.nextRow.amount).toBe(scenario.expectedValue)
      expect(rows.model.getData()[0]!.amount).toBe(scenario.expectedValue)
      wrapper.unmount()
    }

    runScenario({
      getValue: () => null,
      expectedInitial: null,
      draft: 8,
      expectedOldValue: null,
      expectedValue: 8,
    })
    runScenario({
      getValue: () => undefined,
      expectedInitial: undefined,
      draft: 8,
      expectedOldValue: undefined,
      expectedValue: 8,
    })
    runScenario({ expectedInitial: 7, draft: 8, expectedOldValue: 7, expectedValue: 8 })
    runScenario({
      expectedInitial: 7,
      draft: '8',
      expectedOldValue: 7,
      expectedValue: 8,
      coerce: (draft) => Number(draft),
    })
  })

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
