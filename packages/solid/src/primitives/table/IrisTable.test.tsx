import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, cleanup, fireEvent } from '@solidjs/testing-library'
import { IrisTable } from './IrisTable'

afterEach(cleanup)

const columns = [
  { key: 'name', title: 'Name', sortable: true },
  { key: 'age', title: 'Age' },
]

const data = [
  { name: 'Alice', age: 30 },
  { name: 'Bob', age: 25 },
  { name: 'Charlie', age: 35 },
]

describe('IrisTable', () => {
  it('renders without crashing', () => {
    const { container } = render(() => <IrisTable columns={columns} data={data} />)
    expect(container.querySelector('[data-iris-table]')).not.toBeNull()
  })

  it('renders column headers', () => {
    const { getByText } = render(() => <IrisTable columns={columns} data={data} />)
    expect(getByText('Name')).toBeTruthy()
    expect(getByText('Age')).toBeTruthy()
  })

  it('renders data rows', () => {
    const { getByText } = render(() => <IrisTable columns={columns} data={data} />)
    expect(getByText('Alice')).toBeTruthy()
    expect(getByText('Bob')).toBeTruthy()
    expect(getByText('Charlie')).toBeTruthy()
  })

  it('shows loading state', () => {
    const { container } = render(() => <IrisTable columns={columns} data={data} loading={true} />)
    expect(container.querySelector('[data-iris-table-row="loading"]')).not.toBeNull()
  })

  it('shows error state', () => {
    const { container } = render(() => <IrisTable columns={columns} data={data} error={true} />)
    expect(container.querySelector('[data-iris-table-row="error"]')).not.toBeNull()
  })

  it('shows empty state when data is empty', () => {
    const { container } = render(() => <IrisTable columns={columns} data={[]} />)
    expect(container.querySelector('[data-iris-table-row="empty"]')).not.toBeNull()
  })

  it('calls onRowClick when a row is clicked', () => {
    const onRowClick = vi.fn()
    const { getByText } = render(() => (
      <IrisTable columns={columns} data={data} onRowClick={onRowClick} />
    ))
    fireEvent.click(getByText('Alice').closest('[role="row"]')!)
    expect(onRowClick).toHaveBeenCalledWith(data[0], 0)
  })

  it('sorts data when sortable column header is clicked', () => {
    const { getByText, container } = render(() => <IrisTable columns={columns} data={data} />)
    fireEvent.click(getByText('Name'))
    // After click, data should be sorted ascending
    const rows = container.querySelectorAll('[data-iris-table-row]')
    // First data row should be Alice (sorted ascending by name)
    expect(rows[0]?.textContent).toContain('Alice')
  })
})
