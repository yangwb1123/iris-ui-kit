import { render } from '@testing-library/svelte'
import { describe, expect, it, vi } from 'vitest'
import type { GridEditingCommit, GridRowsTransaction } from '@iris-ui-kit/core/grid'
import GridEditingHarness from './GridEditingHarness.svelte'

type Row = { id: number; name: string }

describe('useGridEditing', () => {
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
