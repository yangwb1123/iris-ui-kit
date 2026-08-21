import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, waitFor } from '@testing-library/svelte'
import IrisTable from './IrisTable.svelte'

afterEach(cleanup)

const columns = [
  {
    key: 'status',
    title: 'Status',
    filterable: true,
    filterOptions: [
      { value: 'active', label: 'Active' },
      { value: 'paused', label: 'Paused' },
    ],
  },
  { key: 'name', title: 'Name' },
]
const data = [
  { id: 1, status: 'active', name: 'Alice' },
  { id: 2, status: 'paused', name: 'Bob' },
  { id: 3, status: 'inactive', name: 'Cara' },
]

function bodyNames(container: HTMLElement): string[] {
  return [...container.querySelectorAll('[data-iris-table-body] [data-iris-table-row]')].map(
    (row) => row.querySelector('[data-iris-table-cell="name"]')?.textContent?.trim() ?? '',
  )
}

describe('IrisTable filterValues', () => {
  it('opens the checkbox panel, applies OR values, and clears them', async () => {
    const onFilterValuesChange = vi.fn()
    const view = render(IrisTable, { props: { columns, data, onFilterValuesChange } })
    expect(bodyNames(view.container)).toEqual(['Alice', 'Bob', 'Cara'])
    await fireEvent.click(view.container.querySelector('[data-iris-filter-trigger="status"]')!)
    await waitFor(() =>
      expect(document.querySelector('[data-iris-table-filter-panel]')).not.toBeNull(),
    )

    const active = document.querySelector<HTMLInputElement>(
      '[data-iris-filter-option="active"] input',
    )!
    const paused = document.querySelector<HTMLInputElement>(
      '[data-iris-filter-option="paused"] input',
    )!
    await fireEvent.click(active)
    await fireEvent.click(paused)
    await fireEvent.click(document.querySelector('[data-iris-filter-confirm]')!)

    expect(onFilterValuesChange).toHaveBeenCalledWith({ status: ['active', 'paused'] })
    await waitFor(() => expect(bodyNames(view.container)).toEqual(['Alice', 'Bob']))

    await fireEvent.click(view.container.querySelector('[data-iris-filter-trigger="status"]')!)
    await waitFor(() => expect(document.querySelector('[data-iris-filter-clear]')).not.toBeNull())
    await fireEvent.click(document.querySelector('[data-iris-filter-clear]')!)
    expect(onFilterValuesChange).toHaveBeenLastCalledWith({})
    await waitFor(() => expect(bodyNames(view.container)).toEqual(['Alice', 'Bob', 'Cara']))
  })

  it('keeps controlled values authoritative when the callback is rejected', async () => {
    const onFilterValuesChange = vi.fn()
    const view = render(IrisTable, {
      props: { columns, data, filterValues: { status: ['active'] }, onFilterValuesChange },
    })
    expect(bodyNames(view.container)).toEqual(['Alice'])
    await fireEvent.click(view.container.querySelector('[data-iris-filter-trigger="status"]')!)
    await waitFor(() => expect(document.querySelector('[data-iris-filter-confirm]')).not.toBeNull())
    await fireEvent.click(document.querySelector('[data-iris-filter-option="paused"] input')!)
    await fireEvent.click(document.querySelector('[data-iris-filter-confirm]')!)
    expect(onFilterValuesChange).toHaveBeenCalledWith({ status: ['active', 'paused'] })
    expect(bodyNames(view.container)).toEqual(['Alice'])
  })
})
