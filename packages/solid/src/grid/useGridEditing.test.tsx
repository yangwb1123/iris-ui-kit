import { cleanup, renderHook } from '@solidjs/testing-library'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { GRID_EDITING_CHANGE_EVENT } from '@iris-ui-kit/core/grid'
import { useGridCore, useGridEditing, useGridRows } from './index'

afterEach(cleanup)

type Row = { id: number; name: string }

describe('useGridEditing', () => {
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
