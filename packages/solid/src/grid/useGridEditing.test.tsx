import { cleanup, renderHook } from '@solidjs/testing-library'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { GRID_EDITING_CHANGE_EVENT, type GridEditingCommit } from '@iris-ui-kit/core/grid'
import { useGridCore, useGridEditing, useGridRows } from './index'

afterEach(cleanup)

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
      const result = renderHook(() => {
        const core = useGridCore<AmountRow>()
        const rows = useGridRows(core, [{ id: 1, amount: 7 }])
        const editing = useGridEditing(core, {
          getRowKey: (row) => row.id,
          ...(scenario.getValue ? { getValue: scenario.getValue } : {}),
          ...(scenario.coerce ? { coerce: scenario.coerce } : {}),
          onCommit,
        })
        return { rows, editing }
      })

      expect(result.result.editing.startCellEdit(1, 'amount')).toBe(true)
      expect(result.result.editing.model.getDraft()).toBe(scenario.expectedInitial)
      result.result.editing.setCellDraft(scenario.draft)
      expect(result.result.editing.commitCellEdit()).toBe(true)
      expect(onCommit).toHaveBeenCalledTimes(1)
      const commit = onCommit.mock.calls[0]![0]
      expect(commit.oldValue).toBe(scenario.expectedOldValue)
      expect(commit.value).toBe(scenario.expectedValue)
      expect(commit.nextRow.amount).toBe(scenario.expectedValue)
      expect(result.result.rows.model.getData()[0]!.amount).toBe(scenario.expectedValue)
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

  it('isolates mutable bridge snapshots from Core editing state', () => {
    const onStateChange = vi.fn()
    const storeObserver = vi.fn()
    const eventObserver = vi.fn()
    const { result } = renderHook(() => {
      const core = useGridCore<Row>()
      useGridRows(core, [{ id: 1, name: 'Ada' }])
      const editing = useGridEditing(core, {
        getRowKey: (row) => row.id,
        onStateChange,
      })
      return { core, editing }
    })

    const unsubscribeStore = result.editing.model.store.subscribe(storeObserver)
    const unsubscribeEvent = result.core.on(GRID_EDITING_CHANGE_EVENT, eventObserver)
    expect(result.editing.state().editing).toBeNull()

    expect(result.editing.startCellEdit(1, 'name')).toBe(true)
    const snapshot = result.editing.state()
    const coreState = result.editing.model.store.getState()
    expect(snapshot).not.toBe(coreState)
    expect(snapshot.editing).not.toBe(coreState.editing)

    const counts = {
      store: storeObserver.mock.calls.length,
      state: onStateChange.mock.calls.length,
      event: eventObserver.mock.calls.length,
    }
    snapshot.error = 'locally mutated'
    snapshot.editing!.rowKey = 'locally mutated'

    expect(result.editing.model.getState()).toMatchObject({
      editing: { rowKey: 1, columnKey: 'name' },
      error: null,
    })
    expect(result.editing.model.store.getState()).toMatchObject({
      editing: { rowKey: 1, columnKey: 'name' },
      error: null,
    })
    expect(result.editing.isCellEditing(1, 'name')).toBe(true)
    expect(storeObserver).toHaveBeenCalledTimes(counts.store)
    expect(onStateChange).toHaveBeenCalledTimes(counts.state)
    expect(eventObserver).toHaveBeenCalledTimes(counts.event)

    result.editing.setCellDraft('Grace')
    const fresh = result.editing.state()
    expect(fresh).not.toBe(snapshot)
    expect(fresh).toMatchObject({
      editing: { rowKey: 1, columnKey: 'name' },
      draft: 'Grace',
      error: null,
    })

    unsubscribeStore()
    unsubscribeEvent()
  })

  it('shares the rows feature and exposes a reactive Solid state accessor', () => {
    const onCommit = vi.fn()
    let transaction: { reason: string; meta: unknown } | undefined
    const { result } = renderHook(() => {
      const core = useGridCore<Row>()
      const rows = useGridRows(core, [{ id: 1, name: 'Ada' }], {
        onRowsChange: (next) => {
          transaction = next
        },
      })
      const editing = useGridEditing(core, {
        getRowKey: (row) => row.id,
        onCommit,
        commitOptions: { meta: { source: 'solid-test' } },
      })
      return { core, rows, editing }
    })

    expect(result.editing.state().editing).toBeNull()
    expect(result.editing.startCellEdit(1, 'name')).toBe(true)
    result.editing.setCellDraft('Grace')
    expect(result.editing.commitCellEdit()).toBe(true)

    expect(result.rows.rows()[0]?.name).toBe('Grace')
    expect(result.editing.state().editing).toBeNull()
    expect(transaction).toMatchObject({ reason: 'cell-edit', meta: { source: 'solid-test' } })
    expect(onCommit).toHaveBeenCalledWith(
      expect.objectContaining({ rowKey: 1, columnKey: 'name', value: 'Grace' }),
    )
  })
})
