import { cleanup, renderHook } from '@solidjs/testing-library'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useGridCore, useGridEditing, useGridRows } from './index'

afterEach(cleanup)

type Row = { id: number; name: string }

describe('useGridEditing', () => {
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
