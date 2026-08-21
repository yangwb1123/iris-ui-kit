import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render } from '@solidjs/testing-library'
import { IrisTable } from './IrisTable'
import type { IrisTableColumn } from './types'

afterEach(cleanup)

interface Row extends Record<string, unknown> {
  id: number
  name: string
}

const rows: Row[] = [
  { id: 1, name: 'Alice' },
  { id: 2, name: 'Bob' },
]

describe('IrisTable unique edit rule', () => {
  it('checks the current rows and keeps the editor open on duplicates', async () => {
    const onCellEdit = vi.fn()
    const columns: IrisTableColumn<Row>[] = [
      {
        key: 'name',
        title: 'Name',
        editable: true,
        editRules: [{ unique: true }],
      },
    ]
    const { container } = render(() => (
      <IrisTable columns={columns} data={rows} rowKey="id" onCellEdit={onCellEdit} />
    ))

    const firstCell = container.querySelector(
      '[data-iris-table-row] [data-iris-table-cell="name"]',
    )!
    fireEvent.dblClick(firstCell)
    const editor = () => container.querySelector<HTMLInputElement>('[data-iris-table-editor]')
    fireEvent.input(editor()!, { target: { value: 'Bob' } })
    fireEvent.keyDown(editor()!, { key: 'Enter' })
    await Promise.resolve()

    expect(editor()).not.toBeNull()
    expect(editor()!.getAttribute('aria-invalid')).toBe('true')
    expect(container.querySelector('[data-iris-table-editor-error]')?.textContent).toBe(
      'Value must be unique',
    )
    expect(onCellEdit).not.toHaveBeenCalled()

    fireEvent.input(editor()!, { target: { value: 'Cara' } })
    fireEvent.keyDown(editor()!, { key: 'Enter' })
    await Promise.resolve()
    expect(editor()).toBeNull()
    expect(onCellEdit).toHaveBeenCalledWith(expect.objectContaining({ newValue: 'Cara' }))
  })
})
