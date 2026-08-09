import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react'
import { IrisTable } from '../Table'
import type { IrisTableColumn, IrisTableContextMenuParams } from '../types'

afterEach(() => cleanup())

interface Row extends Record<string, unknown> {
  id: number
  name: string
  status: string
  level: number
}

const rows: Row[] = [
  { id: 1, name: 'Charlie', status: 'active', level: 1 },
  { id: 2, name: 'Alice', status: 'paused', level: 2 },
  { id: 3, name: 'Bob', status: 'active', level: 3 },
]

const selectCols: IrisTableColumn<Row>[] = [
  { key: 'name', title: 'Name' },
  {
    key: 'status',
    title: 'Status',
    editable: true,
    editor: 'select',
    editOptions: [
      { value: 'active', label: 'Active' },
      { value: 'paused', label: 'Paused' },
    ],
  },
  {
    key: 'level',
    title: 'Level',
    editable: true,
    editor: 'select',
    editOptions: [
      { value: 1, label: 'One' },
      { value: 2, label: 'Two' },
      { value: 3, label: 'Three' },
    ],
  },
]

const baseColumns: IrisTableColumn<Row>[] = [
  { key: 'name', title: 'Name' },
  { key: 'status', title: 'Status' },
]

function cell(rowId: string | number, key: string): HTMLElement {
  return document.querySelector(
    `[data-iris-table-row="${rowId}"] [data-iris-table-cell="${key}"]`,
  ) as HTMLElement
}
function selectEditor(): HTMLSelectElement | null {
  return document.querySelector('[data-iris-table-editor-select]')
}
function contextMenu(): HTMLElement | null {
  return document.querySelector('[data-iris-table-context-menu]')
}

describe('@iris-ui-kit/react IrisTable select editor (vxe edit-render parity, batch H)', () => {
  function renderSelectTable(onCellEdit: ReturnType<typeof vi.fn>): void {
    render(
      <IrisTable
        columns={selectCols}
        data={rows}
        rowKey="id"
        editConfig={{ trigger: 'click' }}
        onCellEdit={onCellEdit}
      />,
    )
  }

  it('clicking an editable select cell opens a native select with the options', () => {
    renderSelectTable(vi.fn())
    act(() => {
      fireEvent.click(cell(1, 'status'))
    })
    const sel = selectEditor()
    expect(sel).not.toBeNull()
    expect(sel!.tagName).toBe('SELECT')
    expect(sel!.getAttribute('data-iris-table-editor')).toBe('')
    expect(Array.from(sel!.options).map((o) => o.textContent)).toEqual(['Active', 'Paused'])
    expect(sel!.value).toBe('active') // seeded from the raw cell value
  })

  it('choosing an option + Enter commits the TYPED string value', () => {
    const onCellEdit = vi.fn()
    renderSelectTable(onCellEdit)
    act(() => {
      fireEvent.click(cell(1, 'status'))
    })
    act(() => {
      fireEvent.change(selectEditor()!, { target: { value: 'paused' } })
      fireEvent.keyDown(selectEditor()!, { key: 'Enter' })
    })
    expect(onCellEdit).toHaveBeenCalledWith(
      expect.objectContaining({ oldValue: 'active', newValue: 'paused', rowIndex: 0 }),
    )
    expect(selectEditor()).toBeNull()
    // Write-back: the committed value renders in the cell.
    expect(cell(1, 'status').textContent).toBe('paused')
  })

  it('a NUMBER option commits a number (draft keeps the typed form)', () => {
    const onCellEdit = vi.fn()
    renderSelectTable(onCellEdit)
    act(() => {
      fireEvent.click(cell(1, 'level'))
    })
    expect(selectEditor()!.value).toBe('1')
    act(() => {
      fireEvent.change(selectEditor()!, { target: { value: '2' } })
      fireEvent.keyDown(selectEditor()!, { key: 'Enter' })
    })
    expect(onCellEdit).toHaveBeenCalledWith(expect.objectContaining({ newValue: 2 }))
    expect(onCellEdit.mock.calls[0]![0].newValue).toBe(2)
  })

  it('blur commits the selected option', () => {
    const onCellEdit = vi.fn()
    renderSelectTable(onCellEdit)
    act(() => {
      fireEvent.click(cell(1, 'status'))
    })
    act(() => {
      fireEvent.change(selectEditor()!, { target: { value: 'active' } })
      fireEvent.blur(selectEditor()!)
    })
    expect(onCellEdit).not.toHaveBeenCalled() // unchanged value → no event
    act(() => {
      fireEvent.click(cell(1, 'status'))
    })
    act(() => {
      fireEvent.change(selectEditor()!, { target: { value: 'paused' } })
      fireEvent.blur(selectEditor()!)
    })
    expect(onCellEdit).toHaveBeenCalledWith(expect.objectContaining({ newValue: 'paused' }))
  })

  it('Escape cancels without emitting', () => {
    const onCellEdit = vi.fn()
    renderSelectTable(onCellEdit)
    act(() => {
      fireEvent.click(cell(1, 'status'))
    })
    act(() => {
      fireEvent.change(selectEditor()!, { target: { value: 'paused' } })
      fireEvent.keyDown(selectEditor()!, { key: 'Escape' })
    })
    expect(onCellEdit).not.toHaveBeenCalled()
    expect(selectEditor()).toBeNull()
  })

  it('a value matching no option renders a synthetic option — a plain blur keeps it', () => {
    const rowsWithUnknown = [{ ...rows[0], status: 'suspended' }]
    const onCellEdit = vi.fn()
    render(
      <IrisTable
        columns={selectCols}
        data={rowsWithUnknown}
        rowKey="id"
        editConfig={{ trigger: 'click' }}
        onCellEdit={onCellEdit}
      />,
    )
    act(() => {
      fireEvent.click(cell(1, 'status'))
    })
    const sel = selectEditor()!
    expect(Array.from(sel.options).some((o) => o.value === 'suspended')).toBe(true)
    expect(sel.value).toBe('suspended')
    act(() => {
      fireEvent.blur(sel)
    })
    // No option matched, so nothing changed — the raw value survives.
    expect(onCellEdit).not.toHaveBeenCalled()
    expect(cell(1, 'status').textContent).toBe('suspended')
  })

  it('a select editor without editOptions falls back to the text input', () => {
    const cols: IrisTableColumn<Row>[] = [
      { key: 'name', title: 'Name' },
      { key: 'status', title: 'Status', editable: true, editor: 'select' },
    ]
    render(<IrisTable columns={cols} data={rows} editConfig={{ trigger: 'click' }} />)
    act(() => {
      fireEvent.click(cell(1, 'status'))
    })
    expect(selectEditor()).toBeNull()
    expect(document.querySelector('[data-iris-table-editor]')?.tagName).toBe('INPUT')
  })
})

describe('@iris-ui-kit/react IrisTable contextMenu (vxe contextMenu parity, batch H)', () => {
  function renderMenuTable(onSelect: ReturnType<typeof vi.fn>): HTMLElement {
    const { container } = render(
      <IrisTable
        columns={baseColumns}
        data={rows}
        rowKey="id"
        contextMenu={{
          items: (params: IrisTableContextMenuParams<Row>) => [
            { key: 'edit', label: 'Edit row' },
            { key: 'delete', label: 'Delete row', disabled: params.rowIndex === 1 },
          ],
          onSelect,
        }}
      />,
    )
    return container
  }

  it('right-clicking a body cell opens the menu at the cursor with the items', async () => {
    renderMenuTable(vi.fn())
    fireEvent.contextMenu(cell(1, 'name'), { clientX: 120, clientY: 80 })
    const menu = contextMenu()
    expect(menu).not.toBeNull()
    // Portaled to document.body (the table root clips overflow).
    expect(menu!.parentElement).toBe(document.body)
    expect(menu!.getAttribute('role')).toBe('menu')
    const items = menu!.querySelectorAll('[data-iris-table-context-menu-item]')
    expect(items.length).toBe(2)
    expect(items[0]!.textContent).toBe('Edit row')
    expect(items[1]!.textContent).toBe('Delete row')
    // Positioned at the cursor via the virtual anchor.
    await waitFor(() => {
      expect(menu!.style.transform).toContain('translate3d(120px, 80px')
    })
  })

  it('clicking an item fires onSelect with the key + params and closes', () => {
    const onSelect = vi.fn()
    renderMenuTable(onSelect)
    fireEvent.contextMenu(cell(2, 'name'), { clientX: 10, clientY: 10 })
    const editItem = document.querySelector('[data-iris-table-context-menu-item="edit"]')!
    fireEvent.click(editItem)
    expect(onSelect).toHaveBeenCalledWith(
      'edit',
      expect.objectContaining({
        row: rows[1],
        rowIndex: 1,
        columnIndex: 0,
      }),
    )
    expect(onSelect.mock.calls[0]![1].column).toBe(baseColumns[0])
    expect(contextMenu()).toBeNull()
  })

  it('Escape closes the menu', () => {
    renderMenuTable(vi.fn())
    fireEvent.contextMenu(cell(1, 'name'), { clientX: 10, clientY: 10 })
    expect(contextMenu()).not.toBeNull()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(contextMenu()).toBeNull()
  })

  it('outside pointer-down closes the menu', () => {
    renderMenuTable(vi.fn())
    fireEvent.contextMenu(cell(1, 'name'), { clientX: 10, clientY: 10 })
    expect(contextMenu()).not.toBeNull()
    fireEvent.pointerDown(document.body)
    expect(contextMenu()).toBeNull()
  })

  it('scroll closes the menu (capture-phase document listener)', () => {
    renderMenuTable(vi.fn())
    fireEvent.contextMenu(cell(1, 'name'), { clientX: 10, clientY: 10 })
    expect(contextMenu()).not.toBeNull()
    fireEvent.scroll(document.body)
    expect(contextMenu()).toBeNull()
  })

  it('a disabled item is inert: click does not fire onSelect and the menu stays', () => {
    const onSelect = vi.fn()
    renderMenuTable(onSelect)
    // Row index 1 → the delete item is disabled.
    fireEvent.contextMenu(cell(2, 'status'), { clientX: 10, clientY: 10 })
    const deleteItem = document.querySelector(
      '[data-iris-table-context-menu-item="delete"]',
    ) as HTMLButtonElement
    expect(deleteItem.disabled).toBe(true)
    expect(deleteItem.getAttribute('aria-disabled')).toBe('true')
    fireEvent.click(deleteItem)
    expect(onSelect).not.toHaveBeenCalled()
    expect(contextMenu()).not.toBeNull()
  })

  it('right-clicking the header does NOT open the menu', () => {
    const onSelect = vi.fn()
    const container = renderMenuTable(onSelect)
    fireEvent.contextMenu(container.querySelector('[data-iris-table-header="name"]')!)
    expect(contextMenu()).toBeNull()
    expect(onSelect).not.toHaveBeenCalled()
  })

  it('without the contextMenu prop, right-click does nothing', () => {
    render(<IrisTable columns={baseColumns} data={rows} rowKey="id" />)
    fireEvent.contextMenu(cell(1, 'name'), { clientX: 10, clientY: 10 })
    expect(contextMenu()).toBeNull()
  })

  it('right-clicking while another menu is open repositions to the new cursor', async () => {
    renderMenuTable(vi.fn())
    fireEvent.contextMenu(cell(1, 'name'), { clientX: 30, clientY: 40 })
    await waitFor(() => {
      expect(contextMenu()!.style.transform).toContain('translate3d(30px, 40px')
    })
    // The outside pointer-down of the second right-click closes the first
    // menu; the contextmenu reopens it at the new coordinates.
    fireEvent.contextMenu(cell(3, 'name'), { clientX: 200, clientY: 150 })
    await waitFor(() => {
      expect(contextMenu()!.style.transform).toContain('translate3d(200px, 150px')
    })
  })
})

describe('@iris-ui-kit/react IrisTable cross-page selection (proxy mode, batch H)', () => {
  it('page flips keep the selection (iris always reserves)', async () => {
    const pageRows: Record<number, Row[]> = { 1: [rows[0], rows[1]], 2: [rows[2]] }
    const query = vi.fn(async (params: { page: number }) => ({
      rows: pageRows[params.page] ?? [],
      total: 3,
    }))
    const { container } = render(
      <IrisTable
        columns={baseColumns}
        data={[]}
        rowKey="id"
        selectable="multi"
        proxyConfig={{ query, pageSize: 2 }}
      />,
    )
    await waitFor(() => {
      expect(container.querySelector('[data-iris-table-cell="name"]')?.textContent).toBe('Charlie')
    })
    // Select row 1 on page 1 (first checkbox is the page-scoped select-all).
    const rowCheckbox = container.querySelector('[data-iris-table-row="1"] input[type="checkbox"]')!
    fireEvent.click(rowCheckbox)
    expect(
      container
        .querySelector('[data-iris-table-row="1"]')
        ?.getAttribute('data-iris-table-row-selected'),
    ).toBe('true')
    // Flip to page 2 — page-1 rows are gone, none of the visible rows selected.
    fireEvent.click(container.querySelector('[data-iris-pagination-item="next"]')!)
    await waitFor(() => {
      expect(container.querySelector('[data-iris-table-cell="name"]')?.textContent).toBe('Bob')
    })
    expect(container.querySelector('[data-iris-table-row-selected="true"]')).toBeNull()
    // Flip back to page 1 — the selection survived the round trip.
    fireEvent.click(container.querySelector('[data-iris-pagination-item="prev"]')!)
    await waitFor(() => {
      expect(
        container
          .querySelector('[data-iris-table-row="1"]')
          ?.getAttribute('data-iris-table-row-selected'),
      ).toBe('true')
    })
    // And the master checkbox reflects the page-1 subset (page-scoped select-all).
    expect(
      container.querySelector('[data-iris-table-row="header"] input[type="checkbox"]'),
    ).not.toBeNull()
  })
})
