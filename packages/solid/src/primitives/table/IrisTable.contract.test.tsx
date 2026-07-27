import { cleanup, render } from '@solidjs/testing-library'
import { afterEach, describe, expect, it } from 'vitest'
import { IrisTable } from './IrisTable'

afterEach(cleanup)

const columns = [
  { key: 'name', title: 'Name', sortable: true },
  { key: 'age', title: 'Age' },
]

describe('IrisTable state contracts', () => {
  it('renders custom loading, error, and empty states', () => {
    const loading = render(() => (
      <IrisTable columns={columns} data={[]} loading loadingState={<span>Fetching</span>} />
    ))
    expect(loading.container.querySelector('[data-iris-table-row="loading"]')?.textContent).toBe(
      'Fetching',
    )
    loading.unmount()

    const error = render(() => (
      <IrisTable columns={columns} data={[]} error errorState={<span>Boom</span>} />
    ))
    expect(error.container.querySelector('[data-iris-table-row="error"]')?.textContent).toBe('Boom')
    error.unmount()

    const empty = render(() => (
      <IrisTable columns={columns} data={[]} emptyState={<span>Nothing</span>} />
    ))
    expect(empty.container.querySelector('[data-iris-table-row="empty"]')?.textContent).toBe(
      'Nothing',
    )
  })

  it('seeds uncontrolled selection and sorting from defaults', () => {
    const data = [
      { id: 1, name: 'Charlie', age: 35 },
      { id: 2, name: 'Alice', age: 30 },
    ]
    const { container } = render(() => (
      <IrisTable
        columns={columns}
        data={data}
        selectable="multi"
        defaultSelection={[2]}
        defaultSort={{ key: 'name', direction: 'asc' }}
      />
    ))
    const rows = container.querySelectorAll('[data-iris-table-row]')
    expect(rows[0]?.textContent).toContain('Alice')
    expect(rows[0]?.getAttribute('aria-selected')).toBe('true')
  })
})
