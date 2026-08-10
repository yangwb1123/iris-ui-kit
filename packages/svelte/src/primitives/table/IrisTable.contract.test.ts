import { cleanup, render } from '@testing-library/svelte'
import { afterEach, describe, expect, it } from 'vitest'
import IrisTable from './IrisTable.svelte'
import TableStateContractHarness from './TableStateContractHarness.svelte'

afterEach(cleanup)

const columns = [
  { key: 'name', title: 'Name', sortable: true },
  { key: 'age', title: 'Age' },
]

describe('IrisTable state contracts', () => {
  it('renders custom loading, error, and empty state snippets', () => {
    const empty = render(TableStateContractHarness, { props: { kind: 'empty' } })
    expect(empty.container.querySelector('[data-iris-table-row="empty"]')?.textContent).toBe(
      'Nothing',
    )
    empty.unmount()

    const loading = render(TableStateContractHarness, { props: { kind: 'loading' } })
    expect(loading.container.querySelector('[data-iris-table-row="loading"]')?.textContent).toBe(
      'Fetching',
    )
    loading.unmount()

    const error = render(TableStateContractHarness, { props: { kind: 'error' } })
    expect(
      error.container.querySelector('[data-iris-table-row="error"]')?.textContent?.trim(),
    ).toBe('Boom')
  })

  it('seeds uncontrolled selection and sorting from defaults', () => {
    const data = [
      { id: 1, name: 'Charlie', age: 35 },
      { id: 2, name: 'Alice', age: 30 },
    ]
    const { container } = render(IrisTable, {
      props: {
        columns,
        data,
        selectable: 'multi',
        defaultSelection: [2],
        defaultSort: { key: 'name', direction: 'asc' },
      },
    })
    const rows = container.querySelectorAll('[data-iris-table-row]')
    expect(rows[0]?.textContent).toContain('Alice')
    expect(rows[0]?.getAttribute('aria-selected')).toBe('true')
  })
})
