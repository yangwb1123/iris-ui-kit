import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, waitFor } from '@testing-library/svelte'
import IrisTable from './IrisTable.svelte'

afterEach(cleanup)

const rows = [
  { id: 1, name: 'Alice' },
  { id: 2, name: 'Bob' },
]

describe('IrisTable unique edit rule', () => {
  it('checks the current rows and keeps the editor open on duplicates', async () => {
    const { container } = render(IrisTable, {
      props: {
        columns: [
          {
            key: 'name',
            title: 'Name',
            editable: true,
            editRules: [{ unique: true }],
          },
        ],
        data: rows,
      },
    })

    const firstCell = container.querySelector(
      '[data-iris-table-row] [data-iris-table-cell="name"]',
    )!
    await fireEvent.dblClick(firstCell)
    const editor = () => container.querySelector<HTMLInputElement>('[data-iris-table-editor]')
    await fireEvent.input(editor()!, { target: { value: 'Bob' } })
    await fireEvent.keyDown(editor()!, { key: 'Enter' })

    await waitFor(() => {
      expect(editor()).not.toBeNull()
      expect(editor()!.getAttribute('aria-invalid')).toBe('true')
      expect(container.querySelector('[data-iris-table-editor-error]')?.textContent).toBe(
        'Value must be unique',
      )
    })

    await fireEvent.input(editor()!, { target: { value: 'Cara' } })
    await fireEvent.keyDown(editor()!, { key: 'Enter' })
    await waitFor(() => expect(editor()).toBeNull())
  })
})
