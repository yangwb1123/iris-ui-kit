import * as React from 'react'
import { act, fireEvent, render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { GRID_EDITING_CHANGE_EVENT, type GridEditingCommit } from '@iris-ui-kit/core/grid'
import { useGridCore } from './useGridCore'
import { useGridEditing } from './useGridEditing'
import { useGridRows } from './useGridRows'

type Row = { id: number; name: string }
type AmountRow = { id: number; amount: number | null | string }

describe('useGridEditing', () => {
  it('shares the rows feature and exposes a reactive editing session', () => {
    const onCommit = vi.fn()

    function Harness() {
      const core = useGridCore<Row>()
      const rows = useGridRows(core, [{ id: 1, name: 'Ada' }])
      const editing = useGridEditing(core, {
        getRowKey: (row) => row.id,
        onCommit,
      })
      return (
        <div>
          <span data-testid="state">{JSON.stringify(editing.state)}</span>
          <span data-testid="rows">{rows.rows.map((row) => row.name).join(',')}</span>
          <button type="button" onClick={() => editing.startCellEdit(1, 'name')}>
            start
          </button>
          <button type="button" onClick={() => editing.setCellDraft('Grace')}>
            draft
          </button>
          <button type="button" onClick={() => editing.commitCellEdit()}>
            commit
          </button>
        </div>
      )
    }

    const view = render(<Harness />)
    expect(view.getByTestId('state').textContent).toContain('"editing":null')

    fireEvent.click(view.getByRole('button', { name: 'start' }))
    expect(view.getByTestId('state').textContent).toContain('"columnKey":"name"')

    fireEvent.click(view.getByRole('button', { name: 'draft' }))
    fireEvent.click(view.getByRole('button', { name: 'commit' }))

    expect(view.getByTestId('rows').textContent).toBe('Grace')
    expect(onCommit).toHaveBeenCalledWith(
      expect.objectContaining({ rowKey: 1, columnKey: 'name', value: 'Grace' }),
    )
    expect(view.getByTestId('state').textContent).toContain('"editing":null')
    view.unmount()
  })

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

      function Harness() {
        const core = useGridCore<AmountRow>()
        rows = useGridRows(core, [{ id: 1, amount: 7 }])
        editing = useGridEditing(core, {
          getRowKey: (row) => row.id,
          ...(scenario.getValue ? { getValue: scenario.getValue } : {}),
          ...(scenario.coerce ? { coerce: scenario.coerce } : {}),
          onCommit,
        })
        return null
      }

      const view = render(<Harness />)
      act(() => {
        expect(editing.startCellEdit(1, 'amount')).toBe(true)
        expect(editing.model.getDraft()).toBe(scenario.expectedInitial)
        editing.setCellDraft(scenario.draft)
        expect(editing.commitCellEdit()).toBe(true)
      })
      expect(onCommit).toHaveBeenCalledTimes(1)
      const commit = onCommit.mock.calls[0]![0]
      expect(commit.oldValue).toBe(scenario.expectedOldValue)
      expect(commit.value).toBe(scenario.expectedValue)
      expect(commit.nextRow.amount).toBe(scenario.expectedValue)
      expect(rows.model.getData()[0]!.amount).toBe(scenario.expectedValue)
      view.unmount()
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
    let editing!: ReturnType<typeof useGridEditing<Row>>

    function Harness() {
      const core = useGridCore<Row>()
      useGridRows(core, [{ id: 1, name: 'Ada' }])
      editing = useGridEditing(core, {
        getRowKey: (row) => row.id,
        onStateChange,
      })
      return null
    }

    const view = render(<Harness />)
    const unsubscribeStore = editing.model.store.subscribe(storeObserver)
    const unsubscribeEvent = editing.core.on(GRID_EDITING_CHANGE_EVENT, eventObserver)
    expect(editing.state.editing).toBeNull()

    act(() => {
      expect(editing.startCellEdit(1, 'name')).toBe(true)
    })
    const snapshot = editing.state
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

    act(() => editing.setCellDraft('Grace'))
    const fresh = editing.state
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

  it('forwards adapter transaction metadata and keeps rejected cells open', () => {
    function Harness() {
      const core = useGridCore<Row>()
      const rows = useGridRows(core, [{ id: 1, name: 'Ada' }])
      const editing = useGridEditing(core, {
        getRowKey: (row) => row.id,
        validate: (value) => (value === 'ok' ? null : 'invalid'),
        commitOptions: { meta: { source: 'test' } },
      })
      return (
        <div>
          <span data-testid="error">{editing.state.error ?? ''}</span>
          <span data-testid="row">{rows.rows[0]?.name}</span>
          <button type="button" onClick={() => editing.startCellEdit(1, 'name')}>
            start
          </button>
          <button type="button" onClick={() => editing.setCellDraft('bad')}>
            bad
          </button>
          <button type="button" onClick={() => editing.commitCellEdit()}>
            commit
          </button>
        </div>
      )
    }

    const view = render(<Harness />)
    fireEvent.click(view.getByRole('button', { name: 'start' }))
    fireEvent.click(view.getByRole('button', { name: 'bad' }))
    expect(view.getByRole('button', { name: 'commit' })).toBeTruthy()
    expect(view.getByTestId('error').textContent).toBe('invalid')
    expect(view.getByTestId('row').textContent).toBe('Ada')
    view.unmount()
  })
})
