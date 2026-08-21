import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, waitFor } from '@testing-library/svelte'
import IrisTable from './IrisTable.svelte'

afterEach(cleanup)

const columns = [
  {
    key: 'name',
    title: 'Name',
    editable: true,
    editRules: [{ required: true }],
  },
  { key: 'age', title: 'Age', editable: true, editor: 'number' as const },
  { key: 'status', title: 'Status' },
]
const rows = [
  { id: 1, name: 'Alice', age: 30, status: 'active' },
  { id: 2, name: 'Bob', age: 25, status: 'paused' },
]

function cell(container: HTMLElement, rowIndex: number, key: string): HTMLElement {
  const rows = container.querySelectorAll<HTMLElement>(
    '[data-iris-table-body] [data-iris-table-row]',
  )
  return rows[rowIndex]!.querySelector(`[data-iris-table-cell="${key}"]`) as HTMLElement
}

describe('IrisTable editConfig.mode=row', () => {
  it('opens every editable cell, commits one column, and keeps the row session open', async () => {
    const onCellEdit = vi.fn()
    const view = render(IrisTable, {
      props: {
        columns,
        data: rows,
        editConfig: { mode: 'row', showAsterisk: true },
        onCellEdit,
      },
    })

    expect(view.container.querySelector('[data-iris-table-header="name"]')?.textContent).toContain(
      '*',
    )
    await fireEvent.click(cell(view.container, 0, 'name'))
    await waitFor(() =>
      expect(view.container.querySelectorAll('[data-iris-table-editor]')).toHaveLength(2),
    )
    const editors = view.container.querySelectorAll<HTMLInputElement>('[data-iris-table-editor]')
    await fireEvent.input(editors[0]!, { target: { value: 'Alicia' } })
    await fireEvent.keyDown(editors[0]!, { key: 'Enter' })

    expect(onCellEdit).toHaveBeenCalledWith(
      expect.objectContaining({ oldValue: 'Alice', newValue: 'Alicia', rowIndex: 0 }),
    )
    expect(view.container.querySelectorAll('[data-iris-table-editor]')).toHaveLength(1)
    expect(view.container.querySelector('[data-iris-row-editing="true"]')).not.toBeNull()

    await fireEvent.keyDown(
      view.container.querySelector<HTMLInputElement>('[data-iris-table-editor]')!,
      { key: 'Escape' },
    )
    expect(view.container.querySelectorAll('[data-iris-table-editor]')).toHaveLength(0)
  })

  it('Escape cancels all drafts and a validation error blocks switching rows', async () => {
    const onCellEdit = vi.fn()
    const validatedColumns = [
      {
        key: 'name',
        title: 'Name',
        editable: true,
        validate: (value: unknown) => (value === '' ? 'Required' : null),
      },
      columns[1]!,
    ]
    const view = render(IrisTable, {
      props: {
        columns: validatedColumns,
        data: rows,
        editConfig: { mode: 'row' },
        onCellEdit,
      },
    })

    await fireEvent.click(cell(view.container, 0, 'name'))
    await waitFor(() =>
      expect(view.container.querySelectorAll('[data-iris-table-editor]')).toHaveLength(2),
    )
    const nameEditor = view.container.querySelector<HTMLInputElement>('[data-iris-table-editor]')!
    await fireEvent.input(nameEditor, { target: { value: '' } })
    await fireEvent.click(cell(view.container, 1, 'age'))

    expect(
      view.container
        .querySelector('[data-iris-row-editing="true"]')
        ?.getAttribute('data-iris-table-row-index'),
    ).toBe('0')
    expect(view.container.querySelector('[data-iris-table-editor-error]')?.textContent).toBe(
      'Required',
    )
    expect(onCellEdit).not.toHaveBeenCalled()

    await fireEvent.keyDown(nameEditor, { key: 'Escape' })
    expect(view.container.querySelectorAll('[data-iris-table-editor]')).toHaveLength(0)
  })

  it('clicking another row commits the first row before opening the next', async () => {
    const onCellEdit = vi.fn()
    const view = render(IrisTable, {
      props: { columns, data: rows, editConfig: { mode: 'row' }, onCellEdit },
    })
    await fireEvent.click(cell(view.container, 0, 'name'))
    await waitFor(() =>
      expect(view.container.querySelectorAll('[data-iris-table-editor]')).toHaveLength(2),
    )
    await fireEvent.input(
      view.container.querySelector<HTMLInputElement>('[data-iris-table-editor]')!,
      {
        target: { value: 'Alicia' },
      },
    )
    await fireEvent.click(cell(view.container, 1, 'status'))

    await waitFor(() =>
      expect(onCellEdit).toHaveBeenCalledWith(
        expect.objectContaining({ row: rows[0], newValue: 'Alicia', rowIndex: 0 }),
      ),
    )
    expect(
      view.container
        .querySelector('[data-iris-row-editing="true"]')
        ?.getAttribute('data-iris-table-row-index'),
    ).toBe('1')
  })

  it('Escape cancels a pending async rule without a late commit', async () => {
    let resolveRule: ((message: string | null) => void) | undefined
    const onCellEdit = vi.fn()
    const asyncColumns = [
      {
        key: 'name',
        title: 'Name',
        editable: true,
        editRules: [
          {
            validator: () =>
              new Promise<string | null>((resolve) => {
                resolveRule = resolve
              }),
          },
        ],
      },
      columns[1]!,
    ]
    const view = render(IrisTable, {
      props: { columns: asyncColumns, data: rows, editConfig: { mode: 'row' }, onCellEdit },
    })
    await fireEvent.click(cell(view.container, 0, 'name'))
    await waitFor(() =>
      expect(view.container.querySelectorAll('[data-iris-table-editor]')).toHaveLength(2),
    )
    const nameEditor = view.container.querySelector<HTMLInputElement>('[data-iris-table-editor]')!
    await fireEvent.input(nameEditor, { target: { value: 'Alicia' } })
    await fireEvent.blur(nameEditor)
    await fireEvent.keyDown(
      view.container.querySelectorAll<HTMLInputElement>('[data-iris-table-editor]')[1]!,
      { key: 'Escape' },
    )
    resolveRule?.(null)
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(onCellEdit).not.toHaveBeenCalled()
  })
})
