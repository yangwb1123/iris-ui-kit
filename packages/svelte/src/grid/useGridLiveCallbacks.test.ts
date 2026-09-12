import { render } from '@testing-library/svelte'
import { tick } from 'svelte'
import { describe, expect, it, vi } from 'vitest'
import type {
  GridColumnsModel,
  GridCore,
  GridEditingCommit,
  GridEditingModel,
  GridRangeChange,
  GridRangeModel,
  GridRowsModel,
  GridRowsTransaction,
  GridVirtualModel,
  GridVirtualRangeChange,
} from '@iris-ui-kit/core/grid'
import GridLiveCallbacksHarness from './GridLiveCallbacksHarness.svelte'

type Row = { id: string; name: string }

interface LiveModels {
  core: GridCore<Row>
  rows: GridRowsModel<Row>
  editing: GridEditingModel
  columns: GridColumnsModel
  virtual: GridVirtualModel
  range: GridRangeModel
}

describe('Svelte Grid live callback bridges', () => {
  it('A Svelte $props() harness replaces editing callbacks/resolvers after mount, then performs an edit; only the replacement callback is invoked and the replacement resolver is used.', async () => {
    let models!: LiveModels
    const oldKey = vi.fn(() => 'old-row')
    const newKey = vi.fn(() => 'new-row')
    const oldCommit = vi.fn<(commit: GridEditingCommit<Row>) => void>()
    const newCommit = vi.fn<(commit: GridEditingCommit<Row>) => void>()
    const oldRows = vi.fn<(transaction: GridRowsTransaction<Row>) => void>()
    const newRows = vi.fn<(transaction: GridRowsTransaction<Row>) => void>()
    const oldCommitOptions = vi.fn(() => ({ meta: { source: 'old' } }))
    const newCommitOptions = vi.fn(() => ({ meta: { source: 'new' } }))

    const view = render(GridLiveCallbacksHarness, {
      props: {
        getRowKey: oldKey,
        items: [{ id: 'item' }],
        estimateSize: 20,
        viewportSize: 20,
        onCommit: oldCommit,
        onRowsChange: oldRows,
        commitOptions: oldCommitOptions,
        onReady: (value: LiveModels) => (models = value),
      },
    })
    await tick()

    expect(models).toBeDefined()
    const initialEditing = models.editing
    const initialRows = models.rows
    oldKey.mockClear()
    oldCommit.mockClear()
    oldRows.mockClear()
    oldCommitOptions.mockClear()

    await view.rerender({
      getRowKey: newKey,
      onCommit: newCommit,
      onRowsChange: newRows,
      commitOptions: newCommitOptions,
    })
    await tick()

    expect(oldKey).not.toHaveBeenCalled()
    expect(oldCommit).not.toHaveBeenCalled()
    expect(oldRows).not.toHaveBeenCalled()
    expect(oldCommitOptions).not.toHaveBeenCalled()
    expect(models.editing).toBe(initialEditing)
    expect(models.rows).toBe(initialRows)
    expect(models.core.invoke<GridEditingModel>('getEditingModel')).toBe(initialEditing)

    expect(models.editing.start('new-row', 'name')).toBe(true)
    models.editing.setDraft('Grace')
    expect(models.editing.commitEdit()).toBe(true)

    expect(oldCommit).not.toHaveBeenCalled()
    expect(oldRows).not.toHaveBeenCalled()
    expect(oldCommitOptions).not.toHaveBeenCalled()
    expect(newCommit).toHaveBeenCalledWith(
      expect.objectContaining({ rowKey: 'new-row', value: 'Grace' }),
    )
    expect(newRows).toHaveBeenCalledWith(
      expect.objectContaining({ reason: 'cell-edit', meta: { source: 'new' } }),
    )
    expect(newCommitOptions).toHaveBeenCalledTimes(1)
    expect(models.rows.find('new-row')).toEqual({ id: 'row', name: 'Grace' })
    view.unmount()
  })

  it('A virtual or range harness replaces its callback after mount, triggers a model change, and verifies the old callback is not called.', async () => {
    let models!: LiveModels
    const oldVirtual = vi.fn<(change: GridVirtualRangeChange) => void>()
    const newVirtual = vi.fn<(change: GridVirtualRangeChange) => void>()
    const oldRange = vi.fn<(change: GridRangeChange) => void>()
    const newRange = vi.fn<(change: GridRangeChange) => void>()

    const view = render(GridLiveCallbacksHarness, {
      props: {
        getRowKey: () => 'row',
        items: Array.from({ length: 10 }, (_, index) => ({ id: String(index) })),
        estimateSize: 20,
        viewportSize: 40,
        onRangeChange: oldVirtual,
        onChange: oldRange,
        onReady: (value: LiveModels) => (models = value),
      },
    })
    await tick()

    const initialVirtual = models.virtual
    const initialRange = models.range
    oldVirtual.mockClear()
    oldRange.mockClear()

    await view.rerender({ onRangeChange: newVirtual, onChange: newRange })
    await tick()

    expect(oldVirtual).not.toHaveBeenCalled()
    expect(oldRange).not.toHaveBeenCalled()
    expect(newVirtual).not.toHaveBeenCalled()
    expect(newRange).not.toHaveBeenCalled()
    expect(models.virtual).toBe(initialVirtual)
    expect(models.range).toBe(initialRange)

    models.virtual.setScroll(20)
    models.range.startRange(1, 1)

    expect(oldVirtual).not.toHaveBeenCalled()
    expect(oldRange).not.toHaveBeenCalled()
    expect(newVirtual).toHaveBeenCalledWith(
      expect.objectContaining({ start: 1, end: expect.any(Number) }),
    )
    expect(newRange).toHaveBeenCalledWith({
      state: { anchor: { row: 1, col: 1 }, active: { row: 1, col: 1 } },
      range: { start: { row: 1, col: 1 }, end: { row: 1, col: 1 } },
    })
    view.unmount()
  })

  it('replaces rows and columns callbacks on the existing models', async () => {
    let models!: LiveModels
    const oldKey = vi.fn(() => 'old-row')
    const newKey = vi.fn(() => 'new-row')
    const oldRows = vi.fn<(transaction: GridRowsTransaction<Row>) => void>()
    const newRows = vi.fn<(transaction: GridRowsTransaction<Row>) => void>()
    const oldVisibility = vi.fn<(value: Record<string, boolean>) => void>()
    const newVisibility = vi.fn<(value: Record<string, boolean>) => void>()

    const view = render(GridLiveCallbacksHarness, {
      props: {
        getRowKey: oldKey,
        items: [{ id: 'item' }],
        estimateSize: 20,
        viewportSize: 20,
        onRowsChange: oldRows,
        onVisibilityChange: oldVisibility,
        onReady: (value: LiveModels) => (models = value),
      },
    })
    await tick()

    const initialRows = models.rows
    const initialColumns = models.columns
    oldKey.mockClear()
    oldRows.mockClear()
    oldVisibility.mockClear()

    await view.rerender({
      getRowKey: newKey,
      onRowsChange: newRows,
      onVisibilityChange: newVisibility,
    })
    await tick()

    expect(oldKey).not.toHaveBeenCalled()
    expect(oldRows).not.toHaveBeenCalled()
    expect(oldVisibility).not.toHaveBeenCalled()
    expect(models.rows).toBe(initialRows)
    expect(models.columns).toBe(initialColumns)

    expect(models.rows.update('new-row', { name: 'Updated' })).toBe(true)
    models.columns.setVisibility({ hidden: true })

    expect(oldRows).not.toHaveBeenCalled()
    expect(oldVisibility).not.toHaveBeenCalled()
    expect(newRows).toHaveBeenCalledWith(expect.objectContaining({ reason: 'edit' }))
    expect(newVisibility).toHaveBeenCalledWith({ hidden: true })
    expect(models.rows.find('new-row')).toEqual({ id: 'row', name: 'Updated' })
    view.unmount()
  })
})
