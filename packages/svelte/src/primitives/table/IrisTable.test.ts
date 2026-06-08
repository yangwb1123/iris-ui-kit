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
