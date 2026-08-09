import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react'
import { IrisTable } from '../Table'
import type { IrisTableColumn } from '../types'

afterEach(() => cleanup())

interface Row extends Record<string, unknown> {
  id: number
  name: string
  status: string
  age: number
}

const rows: Row[] = [
  { id: 1, name: 'Charlie', status: 'active', age: 25 },
  { id: 2, name: 'Alice', status: 'paused', age: 32 },
  { id: 3, name: 'Bob', status: 'active', age: 28 },
]

const columns: IrisTableColumn<Row>[] = [
  { key: 'name', title: 'Name' },
  { key: 'status', title: 'Status' },
  { key: 'age', title: 'Age' },
]

function formConfig(
  onSearch?: (values: Record<string, string>) => void,
  onReset?: (values: Record<string, string>) => void,
): {
  fields: Array<
    | { key: string; label: string; placeholder?: string; defaultValue?: string }
    | {
        key: string
        label: string
        type: 'select'
        options: Array<{ value: string; label: string }>
      }
  >
  onSearch?: (values: Record<string, string>) => void
  onReset?: (values: Record<string, string>) => void
} {
  return {
    fields: [
      { key: 'name', label: 'Name', placeholder: 'Filter by name' },
      {
        key: 'status',
        label: 'Status',
        type: 'select',
        options: [
          { value: 'active', label: 'Active' },
          { value: 'paused', label: 'Paused' },
        ],
      },
    ],
    onSearch,
    onReset,
  }
}

function nameInput(container: HTMLElement): HTMLInputElement {
  return container.querySelector('[data-iris-table-form-field="name"] input') as HTMLInputElement
}

function statusTrigger(container: HTMLElement): HTMLElement {
  return container.querySelector(
    '[data-iris-table-form-field="status"] [data-iris-select-trigger]',
  ) as HTMLElement
}

function submitButton(container: HTMLElement): HTMLElement {
  return container.querySelector('[data-iris-table-form-submit]') as HTMLElement
}

function resetButton(container: HTMLElement): HTMLElement {
  return container.querySelector('[data-iris-table-form-reset]') as HTMLElement
}

describe('IrisTable formConfig (vxe-grid formConfig parity, batch D)', () => {
  it('renders the form above the toolbar with labels + text/select controls', () => {
    const { container } = render(
      <IrisTable
        columns={columns}
        data={rows}
        rowKey="id"
        formConfig={{
          fields: [
            { key: 'name', label: 'Name', defaultValue: 'Ada' },
            {
              key: 'status',
              label: 'Status',
              type: 'select',
              options: [{ value: 'active', label: 'Active' }],
            },
          ],
          submitText: 'Go',
          resetText: 'Clear',
        }}
        toolbar={{ title: 'Users' }}
      />,
    )
    const form = container.querySelector('[data-iris-table-form]')!
    // The form renders ABOVE the toolbar.
    const toolbar = container.querySelector('[data-iris-table-toolbar]')!
    expect(form.compareDocumentPosition(toolbar) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    // Text field: label + input seeded from defaultValue.
    const nameField = container.querySelector('[data-iris-table-form-field="name"]')!
    expect(nameField.querySelector('[data-iris-form-field-label]')?.textContent).toBe('Name')
    const input = nameField.querySelector('input') as HTMLInputElement
    expect(input).toBeTruthy()
    expect(input.value).toBe('Ada')
    // Select field: label + trigger button.
    const statusField = container.querySelector('[data-iris-table-form-field="status"]')!
    expect(statusField.querySelector('[data-iris-form-field-label]')?.textContent).toBe('Status')
    expect(statusField.querySelector('[data-iris-select-trigger]')).toBeTruthy()
    // Button labels come from formConfig (defaults are i18n Search/Reset).
    expect(submitButton(container).textContent).toBe('Go')
    expect(resetButton(container).textContent).toBe('Clear')
  })

  it('submit builds stripped values and fires onSearch; select changes update the draft', () => {
    const onSearch = vi.fn()
    const { container } = render(
      <IrisTable columns={columns} data={rows} rowKey="id" formConfig={formConfig(onSearch)} />,
    )
    // Default i18n button labels when formConfig omits them.
    expect(submitButton(container).textContent).toBe('Search')
    expect(resetButton(container).textContent).toBe('Reset')
    fireEvent.change(nameInput(container), { target: { value: 'Cha' } })
    // Untouched select field: empty string is stripped from the submitted values.
    fireEvent.click(submitButton(container))
    expect(onSearch).toHaveBeenLastCalledWith({ name: 'Cha' })
    // Picking a select option updates the draft; the next submit includes it.
    act(() => {
      fireEvent.click(statusTrigger(container))
    })
    const option = Array.from(document.querySelectorAll('[role="option"]')).find(
      (o) => o.textContent === 'Active',
    )!
    act(() => {
      fireEvent.click(option)
    })
    fireEvent.click(submitButton(container))
    expect(onSearch).toHaveBeenLastCalledWith({ name: 'Cha', status: 'active' })
  })

  it('remoteFilter: a later filters prop change keeps the applied form values', async () => {
    const query = vi.fn(async () => ({ rows: [rows[0]], total: 3 }))
    const { container, rerender } = render(
      <IrisTable
        columns={columns}
        data={[]}
        rowKey="id"
        filters={{}}
        formConfig={formConfig()}
        proxyConfig={{ query, remoteFilter: true }}
      />,
    )
    await waitFor(() => expect(query).toHaveBeenCalledTimes(1))
    fireEvent.change(nameInput(container), { target: { value: 'Cha' } })
    fireEvent.click(submitButton(container))
    await waitFor(() =>
      expect(query).toHaveBeenLastCalledWith(expect.objectContaining({ filters: { name: 'Cha' } })),
    )
    // Parent changes the filters prop: the applied form value must survive
    // (the sync effect merges formApplied instead of overwriting with the
    // bare prop, dropping the search silently).
    rerender(
      <IrisTable
        columns={columns}
        data={[]}
        rowKey="id"
        filters={{ status: 'active' }}
        formConfig={formConfig()}
        proxyConfig={{ query, remoteFilter: true }}
      />,
    )
    await waitFor(() =>
      expect(query).toHaveBeenLastCalledWith(
        expect.objectContaining({ filters: { status: 'active', name: 'Cha' } }),
      ),
    )
  })

  it('remote mode: submit re-queries with merged filters (prop + form) and page reset to 1', async () => {
    const query = vi.fn(async () => ({ rows: [rows[0]], total: 3 }))
    const { container } = render(
      <IrisTable
        columns={columns}
        data={[]}
        rowKey="id"
        filters={{ status: 'active' }}
        formConfig={formConfig()}
        proxyConfig={{ query }}
      />,
    )
    await waitFor(() => expect(query).toHaveBeenCalledTimes(1))
    expect(query).toHaveBeenLastCalledWith({ page: 1, pageSize: 10, sort: null, filters: {} })
    fireEvent.change(nameInput(container), { target: { value: 'Cha' } })
    fireEvent.click(submitButton(container))
    await waitFor(() => expect(query).toHaveBeenCalledTimes(2))
    // The prop filter map merges with the form values (form wins on conflict);
    // the filters value change resets the page to 1 (vxe behavior).
    expect(query).toHaveBeenLastCalledWith({
      page: 1,
      pageSize: 10,
      sort: null,
      filters: { status: 'active', name: 'Cha' },
    })
  })

  it('local mode: submit filters rows client-side, merged with the filters prop', () => {
    const filters = { status: 'active' }
    const { container } = render(
      <IrisTable
        columns={columns}
        data={rows}
        rowKey="id"
        filters={filters}
        formConfig={formConfig()}
      />,
    )
    // The prop filter applies immediately: only active rows render (Charlie + Bob).
    expect(container.querySelectorAll('[data-iris-table-cell="name"]').length).toBe(2)
    fireEvent.change(nameInput(container), { target: { value: 'Cha' } })
    fireEvent.click(submitButton(container))
    // status=active (prop) AND name~Cha (form) → only Charlie survives.
    const cells = container.querySelectorAll('[data-iris-table-cell="name"]')
    expect(cells.length).toBe(1)
    expect(cells[0]?.textContent).toBe('Charlie')
    // The prop map is never mutated.
    expect(filters).toEqual({ status: 'active' })
    // Keystrokes before submit do NOT filter (draft/applied two-state).
    fireEvent.change(nameInput(container), { target: { value: 'Alice' } })
    expect(container.querySelectorAll('[data-iris-table-cell="name"]').length).toBe(1)
  })

  it('reset clears the draft, fires onReset and re-queries with cleared filters (remote mode)', async () => {
    const query = vi.fn(async () => ({ rows: [rows[0]], total: 3 }))
    const onReset = vi.fn()
    const { container } = render(
      <IrisTable
        columns={columns}
        data={[]}
        rowKey="id"
        formConfig={formConfig(undefined, onReset)}
        proxyConfig={{ query }}
      />,
    )
    await waitFor(() => expect(query).toHaveBeenCalledTimes(1))
    fireEvent.change(nameInput(container), { target: { value: 'Cha' } })
    fireEvent.click(submitButton(container))
    await waitFor(() => expect(query).toHaveBeenCalledTimes(2))
    fireEvent.click(resetButton(container))
    await waitFor(() => expect(query.mock.calls.length).toBe(3))
    expect(query).toHaveBeenLastCalledWith({ page: 1, pageSize: 10, sort: null, filters: {} })
    expect(nameInput(container).value).toBe('')
    // The parent is notified with the reset values (defaults re-applied).
    expect(onReset).toHaveBeenCalledWith({})
  })

  it('toolbar.buttons render after the built-ins and fire onClick', () => {
    const onClick = vi.fn()
    const onRefresh = vi.fn()
    const { container } = render(
      <IrisTable
        columns={columns}
        data={rows}
        rowKey="id"
        toolbar={{
          title: 'Users',
          onRefresh,
          buttons: [
            { key: 'export', label: 'Export', icon: '⇓', onClick },
            { key: 'clear', label: 'Clear filters', onClick: vi.fn() },
          ],
        }}
      />,
    )
    const exportBtn = container.querySelector('[data-iris-table-toolbar-button-export]')!
    expect(exportBtn).toBeTruthy()
    expect(exportBtn.textContent).toContain('Export')
    expect(exportBtn.textContent).toContain('⇓')
    // Custom buttons come AFTER the built-in refresh button.
    const refreshBtn = container.querySelector('[data-iris-table-toolbar-refresh]')!
    expect(
      refreshBtn.compareDocumentPosition(exportBtn) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
    expect(
      container.querySelector('[data-iris-table-toolbar-button-clear]')?.textContent,
    ).toContain('Clear filters')
    fireEvent.click(exportBtn)
    expect(onClick).toHaveBeenCalledTimes(1)
    expect(onRefresh).not.toHaveBeenCalled()
  })

  it('no formConfig renders no form', () => {
    const { container } = render(<IrisTable columns={columns} data={rows} rowKey="id" />)
    expect(container.querySelector('[data-iris-table-form]')).toBeNull()
  })

  it('proxyConfig + formConfig + edit write-back coexist', async () => {
    const query = vi.fn(async () => ({
      rows: [{ id: 1, name: 'Alice', status: 'active', age: 32 }],
      total: 1,
    }))
    const editable: IrisTableColumn<Row>[] = [
      { key: 'name', title: 'Name', editable: true },
      { key: 'status', title: 'Status' },
      { key: 'age', title: 'Age' },
    ]
    const { container } = render(
      <IrisTable
        columns={editable}
        data={[]}
        rowKey="id"
        formConfig={formConfig()}
        proxyConfig={{ query }}
      />,
    )
    await waitFor(() => {
      expect(container.querySelector('[data-iris-table-cell="name"]')?.textContent).toBe('Alice')
    })
    // The search form renders above the proxy-loaded table.
    expect(container.querySelector('[data-iris-table-form]')).toBeTruthy()
    // Inline edit still commits into the live rows (batch C write-back).
    fireEvent.doubleClick(container.querySelector('[data-iris-table-cell="name"]')!)
    const input = container.querySelector('[data-iris-table-editor]') as HTMLInputElement
    fireEvent.change(input, { target: { value: 'Zoe' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    await waitFor(() => {
      expect(container.querySelector('[data-iris-table-cell="name"]')?.textContent).toBe('Zoe')
    })
    // Form submit re-queries the server with the merged filters.
    fireEvent.change(nameInput(container), { target: { value: 'Ali' } })
    fireEvent.click(submitButton(container))
    await waitFor(() => expect(query.mock.calls.length).toBe(2))
    expect(query).toHaveBeenLastCalledWith({
      page: 1,
      pageSize: 10,
      sort: null,
      filters: { name: 'Ali' },
    })
  })
})
