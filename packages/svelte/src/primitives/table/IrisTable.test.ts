import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, fireEvent, cleanup } from '@testing-library/svelte'
import IrisTable from './IrisTable.svelte'

afterEach(cleanup)

const columns = [
  { key: 'name', title: 'Name', sortable: true },
  { key: 'age', title: 'Age' },
]

const data = [
  { id: 1, name: 'Alice', age: 30 },
  { id: 2, name: 'Bob', age: 25 },
  { id: 3, name: 'Charlie', age: 35 },
]

describe('IrisTable', () => {
  it('renders without crashing', () => {
    const { container } = render(IrisTable, { props: { columns, data } })
    expect(container).toBeTruthy()
  })

  it('renders column headers', () => {
    const { container } = render(IrisTable, { props: { columns, data } })
    const headers = container.querySelectorAll('[role="columnheader"]')
    expect(headers.length).toBe(2)
    expect(headers[0].textContent?.trim()).toContain('Name')
    expect(headers[1].textContent?.trim()).toContain('Age')
  })

  it('renders data rows', () => {
    const { container } = render(IrisTable, { props: { columns, data } })
    const rows = container.querySelectorAll('[data-iris-table-row]')
    expect(rows.length).toBe(3)
  })

  it('shows loading state', () => {
    const { container } = render(IrisTable, { props: { columns, data: [], loading: true } })
    expect(container.querySelector('[data-iris-table-row="loading"]')).not.toBeNull()
  })

  it('shows empty state', () => {
    const { container } = render(IrisTable, { props: { columns, data: [] } })
    expect(container.querySelector('[data-iris-table-row="empty"]')).not.toBeNull()
  })

  it('shows error state', () => {
    const { container } = render(IrisTable, { props: { columns, data: [], error: true } })
    expect(container.querySelector('[data-iris-table-row="error"]')).not.toBeNull()
  })

  it('fires onRowClick', async () => {
    const onRowClick = vi.fn()
    const { container } = render(IrisTable, { props: { columns, data, onRowClick } })
    const rows = container.querySelectorAll('[data-iris-table-row]')
    await fireEvent.click(rows[0])
    expect(onRowClick).toHaveBeenCalledTimes(1)
  })

  it('sorts ascending on header click for sortable column', async () => {
    const onUpdateSort = vi.fn()
    const { container } = render(IrisTable, { props: { columns, data, onUpdateSort } })
    const nameHeader = container.querySelector('[data-iris-table-header="name"]')!
    await fireEvent.click(nameHeader)
    expect(onUpdateSort).toHaveBeenCalledWith({ key: 'name', direction: 'asc' })
  })
})

describe('IrisTable inline-edit validation', () => {
  const validatedCols = [
    {
      key: 'name',
      title: 'Name',
      editable: true,
      validate: (v: unknown) => (String(v).trim() === '' ? 'Name is required' : null),
    },
    { key: 'age', title: 'Age' },
  ]

  function cell(container: HTMLElement, rowIdx: number, key: string): HTMLElement {
    const rows = container.querySelectorAll('[data-iris-table-body] [data-iris-table-row]')
    return rows[rowIdx].querySelector(`[data-iris-table-cell="${key}"]`) as HTMLElement
  }
  function editor(container: HTMLElement): HTMLInputElement | null {
    return container.querySelector('[data-iris-table-editor]')
  }

  it('a failing validator blocks the commit, keeps the editor open, and shows the error', async () => {
    const onCellEdit = vi.fn()
    const { container } = render(IrisTable, {
      props: { columns: validatedCols, data, onCellEdit },
    })
    await fireEvent.dblClick(cell(container, 0, 'name'))
    await fireEvent.input(editor(container)!, { target: { value: '   ' } })
    await fireEvent.keyDown(editor(container)!, { key: 'Enter' })

    expect(onCellEdit).not.toHaveBeenCalled()
    expect(editor(container)).not.toBeNull() // stays open
    expect(editor(container)!.getAttribute('aria-invalid')).toBe('true')
    const err = container.querySelector('[data-iris-table-editor-error]')
    expect(err?.textContent).toBe('Name is required')
    expect(err?.getAttribute('role')).toBe('alert')
    expect(editor(container)!.getAttribute('aria-describedby')).toBe(err?.id)
  })

  it('correcting the value clears the error and commits', async () => {
    const onCellEdit = vi.fn()
    const { container } = render(IrisTable, {
      props: { columns: validatedCols, data, onCellEdit },
    })
    await fireEvent.dblClick(cell(container, 0, 'name'))
    await fireEvent.input(editor(container)!, { target: { value: '' } })
    await fireEvent.keyDown(editor(container)!, { key: 'Enter' })
    expect(onCellEdit).not.toHaveBeenCalled()

    await fireEvent.input(editor(container)!, { target: { value: 'Valid Name' } })
    await fireEvent.keyDown(editor(container)!, { key: 'Enter' })

    expect(onCellEdit).toHaveBeenCalledWith(expect.objectContaining({ newValue: 'Valid Name' }))
    expect(editor(container)).toBeNull()
    expect(container.querySelector('[data-iris-table-editor-error]')).toBeNull()
  })

  it('Escape cancels even while an error is showing', async () => {
    const onCellEdit = vi.fn()
    const { container } = render(IrisTable, {
      props: { columns: validatedCols, data, onCellEdit },
    })
    await fireEvent.dblClick(cell(container, 0, 'name'))
    await fireEvent.input(editor(container)!, { target: { value: '' } })
    await fireEvent.keyDown(editor(container)!, { key: 'Enter' })
    expect(editor(container)).not.toBeNull()

    await fireEvent.keyDown(editor(container)!, { key: 'Escape' })

    expect(editor(container)).toBeNull()
    expect(onCellEdit).not.toHaveBeenCalled()
  })
})
