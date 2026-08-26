import * as React from 'react'
import { fireEvent, render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useGridCore } from './useGridCore'
import { useGridEditing } from './useGridEditing'
import { useGridRows } from './useGridRows'

type Row = { id: number; name: string }

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
