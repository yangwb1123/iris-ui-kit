import { render } from '@testing-library/svelte'
import { get } from 'svelte/store'
import { tick } from 'svelte'
import { describe, expect, it, vi } from 'vitest'
import {
  GRID_EDITING_CHANGE_EVENT,
  type GridCore,
  type GridEditingCommit,
  type GridRowsTransaction,
} from '@iris-ui-kit/core/grid'
import type { UseGridEditingResult } from './useGrid'
import GridEditingHarness from './GridEditingHarness.svelte'

type Row = { id: number; name: string }

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
