import { render } from '@testing-library/svelte'
import { get } from 'svelte/store'
import { tick } from 'svelte'
import { describe, expect, it, vi } from 'vitest'
import {
  GRID_EDITING_CHANGE_EVENT,
  type GridCore,
  type GridEditingCommit,
  type GridRowsModel,
  type GridRowsTransaction,
} from '@iris-ui-kit/core/grid'
import type { UseGridEditingResult } from './useGrid'
import GridEditingHarness from './GridEditingHarness.svelte'

type Row = { id: number; name: string; amount: number | null | string }

describe('useGridEditing', () => {
  it('isolates mutable bridge snapshots from Core editing state', async () => {
    let core!: GridCore<Row>
    let editing!: UseGridEditingResult<Row>
    const onStateChange = vi.fn()
    const storeObserver = vi.fn()
    const eventObserver = vi.fn()
    const view = render(GridEditingHarness, {
      onReady: (nextCore: GridCore<Row>, nextEditing: UseGridEditingResult<Row>) => {
        core = nextCore
        editing = nextEditing
      },
      onStateChange,
    })
    await tick()

    const unsubscribeStore = editing.model.store.subscribe(storeObserver)
    const unsubscribeEvent = core.on(GRID_EDITING_CHANGE_EVENT, eventObserver)
    expect(get(editing.state).editing).toBeNull()

    expect(editing.startCellEdit(1, 'name')).toBe(true)
    await tick()
    const snapshot = get(editing.state)
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
    await tick()
    const fresh = get(editing.state)
    expect(fresh).not.toBe(snapshot)
    expect(fresh).toMatchObject({
      editing: { rowKey: 1, columnKey: 'name' },
      draft: 'Grace',
      error: null,
    })

    unsubscribeStore()
    unsubscribeEvent()
    view.unmount()
  })

  it('preserves explicit getValue results and falls back only when omitted', async () => {
    type Scenario = {
      getValue?: (row: Row, columnKey: string) => unknown
      coerce?: (draft: unknown, row: Row, columnKey: string) => unknown
      expectedInitial: unknown
      draft: unknown
      expectedOldValue: unknown
      expectedValue: unknown
    }

    const runScenario = async (scenario: Scenario) => {
      let core!: GridCore<Row>
      let editing!: UseGridEditingResult<Row>
      const onCommit = vi.fn<(commit: GridEditingCommit<Row>) => void>()
      const view = render(GridEditingHarness, {
        onReady: (nextCore, nextEditing) => {
          core = nextCore
          editing = nextEditing
        },
        getValue: scenario.getValue,
        coerce: scenario.coerce,
        columnKey: 'amount',
        onCommit,
      })
      await tick()

      expect(editing.startCellEdit(1, 'amount')).toBe(true)
      expect(editing.model.getDraft()).toBe(scenario.expectedInitial)
      editing.setCellDraft(scenario.draft)
      expect(editing.commitCellEdit()).toBe(true)
      expect(onCommit).toHaveBeenCalledTimes(1)
      const commit = onCommit.mock.calls[0]![0]
      expect(commit.oldValue).toBe(scenario.expectedOldValue)
      expect(commit.value).toBe(scenario.expectedValue)
      expect(commit.nextRow.amount).toBe(scenario.expectedValue)
      expect(core.invoke<GridRowsModel<Row>>('getRowsModel').getData()[0]!.amount).toBe(
        scenario.expectedValue,
      )
      view.unmount()
    }

    await runScenario({
      getValue: () => null,
      expectedInitial: null,
      draft: 8,
      expectedOldValue: null,
      expectedValue: 8,
    })
    await runScenario({
      getValue: () => undefined,
      expectedInitial: undefined,
      draft: 8,
      expectedOldValue: undefined,
      expectedValue: 8,
    })
    await runScenario({ expectedInitial: 7, draft: 8, expectedOldValue: 7, expectedValue: 8 })
    await runScenario({
      expectedInitial: 7,
      draft: '8',
      expectedOldValue: 7,
      expectedValue: 8,
      coerce: (draft) => Number(draft),
    })
  })

  it('shares rows and bridges the editing feature into Svelte stores', async () => {
    const onCommit = vi.fn<(commit: GridEditingCommit<Row>) => void>()
    const onRowsChange = vi.fn<(transaction: GridRowsTransaction<Row>) => void>()
    const view = render(GridEditingHarness, { onCommit, onRowsChange })
    const button = view.getByRole('button')

    expect(button.textContent).toBe('Ada')
    expect(button.dataset.state).toBe('idle')
    await button.click()

    expect(button.textContent).toBe('Grace')
    expect(button.dataset.state).toBe('idle')
    expect(onCommit).toHaveBeenCalledWith(
      expect.objectContaining({ rowKey: 1, columnKey: 'name', value: 'Grace' }),
    )
    expect(onRowsChange).toHaveBeenCalledWith(
      expect.objectContaining({ reason: 'cell-edit', meta: { source: 'svelte-test' } }),
    )
  })
})
