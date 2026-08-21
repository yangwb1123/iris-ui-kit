import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, waitFor } from '@testing-library/svelte'
import IrisTable from './IrisTable.svelte'

afterEach(cleanup)

const columns = [
  { key: 'name', title: 'Name' },
  { key: 'status', title: 'Status' },
]
const rows = [
  { id: 1, name: 'Alice', status: 'active' },
  { id: 2, name: 'Bob', status: 'paused' },
]

function bodyCell(container: HTMLElement, rowIndex: number, key: string): HTMLElement {
  const row = container.querySelectorAll<HTMLElement>(
    '[data-iris-table-body] [data-iris-table-row]',
  )[rowIndex]
  return row!.querySelector(`[data-iris-table-cell="${key}"]`) as HTMLElement
}

function menu(): HTMLElement | null {
  return document.querySelector('[data-iris-table-context-menu]')
}

describe('IrisTable contextMenu', () => {
  it('opens for body cells, renders items, and emits the selected row/column', async () => {
    const onSelect = vi.fn()
    const items = vi.fn(() => [
      { key: 'edit', label: 'Edit row' },
      { key: 'delete', label: 'Delete row' },
    ])
    const view = render(IrisTable, {
      props: {
        columns,
        data: rows,
        contextMenu: { items, onSelect },
      },
    })

    await fireEvent.contextMenu(bodyCell(view.container, 0, 'name'), {
      clientX: 120,
      clientY: 80,
    })
    await waitFor(() => expect(menu()).not.toBeNull())
    expect(items).toHaveBeenCalledWith(
      expect.objectContaining({ row: rows[0], rowIndex: 0, columnIndex: 0 }),
    )
    expect(menu()!.parentElement).toBe(document.body)
    expect(menu()!.querySelectorAll('[data-iris-table-context-menu-item]')).toHaveLength(2)

    await fireEvent.click(document.querySelector('[data-iris-table-context-menu-item="edit"]')!)
    expect(onSelect).toHaveBeenCalledWith(
      'edit',
      expect.objectContaining({ row: rows[0], column: columns[0], rowIndex: 0, columnIndex: 0 }),
    )
    expect(menu()).toBeNull()
  })

  it('keeps disabled items inert, closes on Escape/outside, and ignores headers', async () => {
    const onSelect = vi.fn()
    const view = render(IrisTable, {
      props: {
        columns,
        data: rows,
        contextMenu: {
          items: (params) => [
            { key: 'edit', label: 'Edit row' },
            { key: 'delete', label: 'Delete row', disabled: params.rowIndex === 1 },
          ],
          onSelect,
        },
      },
    })

    await fireEvent.contextMenu(bodyCell(view.container, 1, 'status'))
    await waitFor(() => expect(menu()).not.toBeNull())
    const disabled = document.querySelector<HTMLButtonElement>(
      '[data-iris-table-context-menu-item="delete"]',
    )!
    expect(disabled.disabled).toBe(true)
    expect(disabled.getAttribute('aria-disabled')).toBe('true')
    await fireEvent.click(disabled)
    expect(onSelect).not.toHaveBeenCalled()
    expect(menu()).not.toBeNull()

    await fireEvent.keyDown(document, { key: 'Escape' })
    expect(menu()).toBeNull()
    await fireEvent.contextMenu(bodyCell(view.container, 0, 'name'))
    await waitFor(() => expect(menu()).not.toBeNull())
    await fireEvent.pointerDown(document.body)
    expect(menu()).toBeNull()

    await fireEvent.contextMenu(view.container.querySelector('[data-iris-table-header="name"]')!)
    expect(menu()).toBeNull()
  })
})
